import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '../clock.js';
import { createApp } from '../app.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { DEMO_PASSWORD, DEMO_EMAIL, seedDemoDataIfEmpty } from '../db/seed.js';

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

describe('GET/PATCH /api/quests (Issue #9 / #11 / #12 / #13 / #17 / #31)', () => {
  let db: Db;
  const iso = '2026-10-28T15:30:00.000Z';
  const clock = fixedClock(iso);

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, clock);
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp() {
    return createApp({ db, clock });
  }

  // AC: Protected routes reject missing/invalid tokens
  it('rejects missing Bearer token with UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/quests/today').expect(401);
    expect(res.body.error).toEqual({
      code: 'UNAUTHORIZED',
      message: expect.any(String),
    });
  });

  it('rejects invalid Bearer token with UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/quests/today')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // AC: User can mark a quest as done from the daily note
  it('PATCH /api/quests/:id/completion marks a quest done', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const today = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const questId = today.body.quests[0].id as number;

    const res = await request(app)
      .patch(`/api/quests/${questId}/completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true })
      .expect(200);

    expect(res.body.quest.completed_at).toBe('2026-10-28T15:30:00Z');
    expect(res.body.progress.xp).toBe(10);
    expect(res.body.progress.current_streak).toBe(1);
    expect(res.body.progress.best_streak).toBe(1);
    expect(res.body.leveled_up).toBe(false);
    expect(res.body.stamp_card.filled_count).toBe(1);
    expect(res.body.stamp_card.stamped_dates).toEqual(['2026-10-28']);
    expect(res.body.card_completed).toBe(false);
  });

  // AC: The current streak and best streak are displayed (via Today + completion)
  it('PATCH completion with local_date bumps streak once per day', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const today = await request(app)
      .get('/api/quests/today?local_date=2026-10-28')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const firstId = today.body.quests[0].id as number;
    const secondId = today.body.quests[1].id as number;

    const first = await request(app)
      .patch(`/api/quests/${firstId}/completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true, local_date: '2026-10-28' })
      .expect(200);
    expect(first.body.progress.current_streak).toBe(1);

    const second = await request(app)
      .patch(`/api/quests/${secondId}/completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true, local_date: '2026-10-28' })
      .expect(200);
    expect(second.body.progress.current_streak).toBe(1);
    expect(second.body.progress.best_streak).toBe(1);
  });

  // AC: User can undo an accidental check-off
  it('PATCH completion false undoes a check-off', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const today = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const questId = today.body.quests[0].id as number;

    await request(app)
      .patch(`/api/quests/${questId}/completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true })
      .expect(200);

    const undone = await request(app)
      .patch(`/api/quests/${questId}/completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: false })
      .expect(200);

    expect(undone.body.quest.completed_at).toBeNull();
    expect(undone.body.progress.xp).toBe(0);
    expect(undone.body.stamp_card.filled_count).toBe(0);
  });

  // AC: Completion status and completion time are saved
  // AC: Completed quests stay completed after a page reload
  it('GET /api/quests/today returns saved completion after reload', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const today = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(today.body.total_count).toBe(3);
    const questId = today.body.quests[0].id as number;

    await request(app)
      .patch(`/api/quests/${questId}/completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true })
      .expect(200);

    const reloaded = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const quest = reloaded.body.quests.find((q: { id: number }) => q.id === questId);
    expect(quest.completed_at).toBe('2026-10-28T15:30:00Z');
    expect(reloaded.body.done_count).toBe(1);
    expect(reloaded.body.progress).toMatchObject({
      xp: 10,
      level: 1,
      xp_into_level: expect.any(Number),
      xp_for_next_level: expect.any(Number),
    });
  });

  it('rejects invalid completion body', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const today = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const questId = today.body.quests[0].id as number;

    await request(app)
      .patch(`/api/quests/${questId}/completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: 'yes' })
      .expect(400);
  });

  // AC: Goal/quest reads and writes are scoped to the authenticated user id
  it('does not expose another user quests or allow completing them', async () => {
    const app = buildApp();
    const demoToken = await loginAsDemo(app);
    const demoToday = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(200);
    const demoQuestId = demoToday.body.quests[0].id as number;

    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@example.com', password: 'secure-pass-1' })
      .expect(201);
    const otherToken = other.body.token as string;

    const otherToday = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(otherToday.body.quests).toEqual([]);
    expect(otherToday.body.total_count).toBe(0);

    const steal = await request(app)
      .patch(`/api/quests/${demoQuestId}/completion`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ completed: true })
      .expect(404);
    expect(steal.body.error.code).toBe('NOT_FOUND');
  });
});
