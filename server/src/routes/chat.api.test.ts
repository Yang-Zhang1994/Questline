import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatAiClient } from '../ai/client.js';
import { countQuestions } from '../ai/parse.js';
import { MOCHI_WELCOME_MESSAGE } from '../ai/prompts/mochiChat.js';
import { TOPIC_QUESTIONS } from '../ai/prompts/mochiInterview.js';
import type { Clock } from '../clock.js';
import { createApp } from '../app.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoDataIfEmpty } from '../db/seed.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

async function loginAsDemo(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    .expect(200);
  return res.body.token as string;
}

describe('GET/POST /api/chat interview (Issue #3)', () => {
  let db: Db;
  const iso = '2026-11-09T15:00:00.000Z';
  const clock = fixedClock(iso);
  let evaluateInterviewAnswer: ReturnType<typeof vi.fn>;
  let completeChat: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, clock);
    evaluateInterviewAnswer = vi.fn(async (input: { user_answer: string; next_topic: string | null }) => ({
      evaluation: 'accepted' as const,
      extracted_answer: input.user_answer,
      mochi_message: input.next_topic
        ? `Got it. ${TOPIC_QUESTIONS[input.next_topic as keyof typeof TOPIC_QUESTIONS]}`
        : 'Lovely — next comes a goal draft to confirm ♡',
    }));
    completeChat = vi.fn(async () => 'Soft chat after interview ♡');
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp(ai?: ChatAiClient) {
    return createApp({
      db,
      clock,
      ai: ai ?? {
        completeChat,
        evaluateInterviewAnswer,
        proposeGoalDraft: vi.fn(),
        reviseGoalDraft: vi.fn(),
      },
    });
  }

  it('rejects missing Bearer token with UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/chat/messages').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET seeds welcome + in-progress interview state in Postgres', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const res = await request(app)
      .get('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].content).toBe(MOCHI_WELCOME_MESSAGE);
    expect(res.body.interview).toMatchObject({
      status: 'in_progress',
      current_topic: 'done_definition',
      answered_topics: [],
    });

    const stored = await db.query<{ status: string; current_topic: string }>(
      `SELECT status, current_topic FROM goal_interviews`,
    );
    expect(stored.rows).toEqual([{ status: 'in_progress', current_topic: 'done_definition' }]);
  });

  it('POST advances a topic with exactly one question and tracks answered topics', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    await request(app)
      .get('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Read a Japanese novel without a dictionary' })
      .expect(201);

    expect(countQuestions(res.body.mochi_message.content)).toBe(1);
    expect(res.body.interview.answered_topics).toEqual(['done_definition']);
    expect(res.body.interview.current_topic).toBe('starting_point');
    expect(evaluateInterviewAnswer).toHaveBeenCalledTimes(1);
  });

  it('keeps the same topic on a vague answer', async () => {
    evaluateInterviewAnswer = vi.fn(async () => ({
      evaluation: 'vague' as const,
      extracted_answer: null,
      mochi_message: 'Could you paint a clearer picture of "done"?',
    }));

    const app = buildApp();
    const token = await loginAsDemo(app);

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'stuff' })
      .expect(201);

    expect(res.body.interview.current_topic).toBe('done_definition');
    expect(res.body.interview.answered_topics).toEqual([]);
    expect(countQuestions(res.body.mochi_message.content)).toBe(1);
  });

  it('covers all four topics then marks the interview complete', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const answers = [
      'Finish one Japanese novel alone',
      'I know hiragana',
      '20 minutes a day',
      'One year from now',
    ];

    for (const content of answers) {
      await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ content })
        .expect(201);
    }

    const res = await request(app)
      .get('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.interview.status).toBe('complete');
    expect(res.body.interview.answered_topics).toEqual([
      'done_definition',
      'starting_point',
      'time_budget',
      'deadline',
    ]);
    expect(res.body.interview.answers.time_budget).toBe('20 minutes a day');
  });

  it('POST /api/chat/interview/restart clears history and resets topics', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Finish one Japanese novel alone' })
      .expect(201);

    const res = await request(app)
      .post('/api/chat/interview/restart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].content).toBe(MOCHI_WELCOME_MESSAGE);
    expect(res.body.interview).toMatchObject({
      status: 'in_progress',
      current_topic: 'done_definition',
      answered_topics: [],
    });

    const messages = await db.query(`SELECT count(*)::int AS n FROM chat_messages`);
    expect(messages.rows[0].n).toBe(1);
  });

  it('rejects empty messages with VALIDATION_ERROR', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '   ' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(evaluateInterviewAnswer).not.toHaveBeenCalled();
  });

  it('returns friendly AI_UNAVAILABLE when the interview mock throws', async () => {
    const app = buildApp({
      completeChat: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
      evaluateInterviewAnswer: vi.fn(async () => {
        throw new Error('network');
      }),
    });
    const token = await loginAsDemo(app);
    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hello' })
      .expect(503);

    expect(res.body.error).toEqual({
      code: 'AI_UNAVAILABLE',
      message: expect.stringMatching(/mochi/i),
    });
  });
});
