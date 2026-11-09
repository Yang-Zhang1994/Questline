import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatAiClient } from '../ai/client.js';
import { MOCHI_WELCOME_MESSAGE } from '../ai/prompts/mochiChat.js';
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

describe('GET/POST /api/chat (Issue #2)', () => {
  let db: Db;
  const iso = '2026-11-09T15:00:00.000Z';
  const clock = fixedClock(iso);
  let completeChat: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, clock);
    completeChat = vi.fn(async () => 'That sounds lovely. What would "done" look like for you?');
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp(ai?: ChatAiClient) {
    return createApp({
      db,
      clock,
      ai: ai ?? { completeChat },
    });
  }

  // AC: JWT-protected chat API
  it('rejects missing Bearer token with UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/chat/messages').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // AC: persist welcome + history in Postgres chat_messages
  it('GET /api/chat/messages seeds a welcome Mochi message', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const res = await request(app)
      .get('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0]).toMatchObject({
      role: 'mochi',
      content: MOCHI_WELCOME_MESSAGE,
    });

    const stored = await db.query<{ role: string; content: string }>(
      `SELECT role, content FROM chat_messages ORDER BY id`,
    );
    expect(stored.rows).toEqual([{ role: 'mochi', content: MOCHI_WELCOME_MESSAGE }]);
  });

  // AC: full history sent with each AI request; mock Claude; persist both sides
  it('POST /api/chat/messages persists user + Mochi turns and calls mocked Claude with full history', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    await request(app)
      .get('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'I want to learn Japanese' })
      .expect(201);

    expect(res.body.user_message).toMatchObject({
      role: 'user',
      content: 'I want to learn Japanese',
    });
    expect(res.body.mochi_message).toMatchObject({
      role: 'mochi',
      content: 'That sounds lovely. What would "done" look like for you?',
    });

    expect(completeChat).toHaveBeenCalledTimes(1);
    expect(completeChat.mock.calls[0][0]).toEqual([
      { role: 'assistant', content: MOCHI_WELCOME_MESSAGE },
      { role: 'user', content: 'I want to learn Japanese' },
    ]);

    const stored = await db.query<{ role: string; content: string }>(
      `SELECT role, content FROM chat_messages ORDER BY id`,
    );
    expect(stored.rows).toEqual([
      { role: 'mochi', content: MOCHI_WELCOME_MESSAGE },
      { role: 'user', content: 'I want to learn Japanese' },
      {
        role: 'mochi',
        content: 'That sounds lovely. What would "done" look like for you?',
      },
    ]);
  });

  it('POST sends accumulated history on a second turn', async () => {
    completeChat
      .mockResolvedValueOnce('Nice! How much time can you spare each day?')
      .mockResolvedValueOnce('Perfect — we can keep steps tiny.');

    const app = buildApp();
    const token = await loginAsDemo(app);

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'learn guitar' })
      .expect(201);

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'about 20 minutes' })
      .expect(201);

    expect(completeChat).toHaveBeenCalledTimes(2);
    const secondCall = completeChat.mock.calls[1][0] as Array<{ role: string; content: string }>;
    expect(secondCall).toEqual([
      { role: 'assistant', content: MOCHI_WELCOME_MESSAGE },
      { role: 'user', content: 'learn guitar' },
      { role: 'assistant', content: 'Nice! How much time can you spare each day?' },
      { role: 'user', content: 'about 20 minutes' },
    ]);
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
    expect(completeChat).not.toHaveBeenCalled();
  });

  it('returns friendly AI_UNAVAILABLE when the Claude mock throws', async () => {
    const app = buildApp({
      completeChat: vi.fn(async () => {
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
