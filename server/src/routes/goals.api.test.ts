import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatAiClient } from '../ai/client.js';
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

async function registerFresh(app: ReturnType<typeof createApp>, email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'fresh-password-123' })
    .expect(201);
  return res.body.token as string;
}

const sampleDraft = {
  title: 'Finish one Japanese novel alone — deadline: One year from now',
  done_definition: 'Finish one Japanese novel alone',
  starting_point: 'I know hiragana',
  time_budget_minutes_per_day: 20,
  deadline: 'One year from now',
  mochi_message: 'Here is a concrete goal ♡',
};

describe('GET/POST /api/goals (Issue #4)', () => {
  let db: Db;
  const iso = '2026-11-09T15:00:00.000Z';
  const clock = fixedClock(iso);
  let proposeGoalDraft: ReturnType<typeof vi.fn>;
  let reviseGoalDraft: ReturnType<typeof vi.fn>;
  let evaluateInterviewAnswer: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, clock);
    proposeGoalDraft = vi.fn(async () => sampleDraft);
    reviseGoalDraft = vi.fn(async () => ({
      ...sampleDraft,
      title: 'Read one graded Japanese novel by 2027-11-09',
      deadline: '2027-11-09',
      mochi_message: 'Tweaked with your note ♡',
    }));
    evaluateInterviewAnswer = vi.fn(async (input: { user_answer: string; next_topic: string | null }) => ({
      evaluation: 'accepted' as const,
      extracted_answer: input.user_answer,
      mochi_message: input.next_topic ? 'Next question?' : 'Interview complete ♡',
    }));
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp(ai?: Partial<ChatAiClient>) {
    const base: ChatAiClient = {
      completeChat: vi.fn(async () => 'soft chat'),
      evaluateInterviewAnswer,
      proposeGoalDraft,
      reviseGoalDraft,
    };
    return createApp({ db, clock, ai: { ...base, ...ai } });
  }

  async function completeInterview(app: ReturnType<typeof createApp>, token: string) {
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
  }

  it('rejects missing Bearer token with UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/goals/draft').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects draft when interview is incomplete', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const res = await request(app)
      .post('/api/goals/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(proposeGoalDraft).not.toHaveBeenCalled();
  });

  // AC: goal based on interview answers; not saved until confirm
  it('proposes a draft from completed interview answers without writing goals', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'goal-draft@questline.test');
    await completeInterview(app, token);

    const res = await request(app)
      .post('/api/goals/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.draft.title).toMatch(/Japanese novel/i);
    expect(res.body.draft.time_budget_minutes_per_day).toBe(20);
    expect(res.body.draft.deadline).toBeTruthy();
    expect(proposeGoalDraft).toHaveBeenCalledTimes(1);

    const goals = await db.query(`SELECT count(*)::int AS n FROM goals WHERE user_id = (
      SELECT id FROM users WHERE email = 'goal-draft@questline.test'
    )`);
    expect(goals.rows[0].n).toBe(0);

    const interview = await db.query<{ goal_draft: unknown }>(
      `SELECT goal_draft FROM goal_interviews WHERE user_id = (
         SELECT id FROM users WHERE email = 'goal-draft@questline.test'
       )`,
    );
    expect(interview.rows[0].goal_draft).toMatchObject({ title: sampleDraft.title });
  });

  it('revises a draft without saving a goal', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'goal-revise@questline.test');
    await completeInterview(app, token);
    await request(app)
      .post('/api/goals/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const res = await request(app)
      .post('/api/goals/draft/revise')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedback: 'Make the deadline a date' })
      .expect(200);

    expect(res.body.draft.deadline).toBe('2027-11-09');
    expect(reviseGoalDraft).toHaveBeenCalledTimes(1);

    const goals = await db.query(`SELECT count(*)::int AS n FROM goals WHERE user_id = (
      SELECT id FROM users WHERE email = 'goal-revise@questline.test'
    )`);
    expect(goals.rows[0].n).toBe(0);
  });

  // AC: saved goal includes deadline, starting point, and time budget
  it('persists the goal to Postgres only on confirm', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'goal-confirm@questline.test');
    await completeInterview(app, token);
    const draftRes = await request(app)
      .post('/api/goals/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const res = await request(app)
      .post('/api/goals/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ draft: draftRes.body.draft })
      .expect(201);

    expect(res.body.goal).toMatchObject({
      title: sampleDraft.title,
      done_definition: sampleDraft.done_definition,
      starting_point: sampleDraft.starting_point,
      time_budget_minutes_per_day: 20,
      deadline: sampleDraft.deadline,
      status: 'active',
    });

    const stored = await db.query<{
      title: string;
      starting_point: string;
      time_budget_minutes_per_day: number;
      deadline: string;
      status: string;
    }>(
      `SELECT title, starting_point, time_budget_minutes_per_day, deadline, status
       FROM goals
       WHERE user_id = (SELECT id FROM users WHERE email = 'goal-confirm@questline.test')`,
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]).toMatchObject({
      title: sampleDraft.title,
      starting_point: sampleDraft.starting_point,
      time_budget_minutes_per_day: 20,
      deadline: sampleDraft.deadline,
      status: 'active',
    });
  });

  it('returns to interview and clears the draft without saving', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'goal-return@questline.test');
    await completeInterview(app, token);
    await request(app)
      .post('/api/goals/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const res = await request(app)
      .post('/api/goals/draft/return-to-interview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.interview.status).toBe('in_progress');
    expect(res.body.interview.current_topic).toBe('done_definition');
    expect(res.body.interview.answers.done_definition).toBeTruthy();

    const interview = await db.query<{ status: string; goal_draft: unknown }>(
      `SELECT status, goal_draft FROM goal_interviews WHERE user_id = (
         SELECT id FROM users WHERE email = 'goal-return@questline.test'
       )`,
    );
    expect(interview.rows[0].status).toBe('in_progress');
    expect(interview.rows[0].goal_draft).toBeNull();
  });

  it('returns friendly AI_UNAVAILABLE when propose mock throws', async () => {
    const app = buildApp({
      proposeGoalDraft: vi.fn(async () => {
        throw new Error('network');
      }),
    });
    const token = await registerFresh(app, 'goal-ai-fail@questline.test');
    await completeInterview(app, token);

    const res = await request(app)
      .post('/api/goals/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(503);

    expect(res.body.error).toEqual({
      code: 'AI_UNAVAILABLE',
      message: expect.stringMatching(/mochi/i),
    });
  });
});
