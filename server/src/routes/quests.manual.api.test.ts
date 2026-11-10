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

async function currentMilestoneId(app: ReturnType<typeof createApp>, token: string): Promise<number> {
  const today = await request(app)
    .get('/api/quests/today')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return today.body.quests[0].milestone_id as number;
}

describe('POST/DELETE /api/quests manual CRUD (Issue #20)', () => {
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

  it('rejects missing Bearer token with UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/quests')
      .send({
        milestone_id: 1,
        title: 'Sketch one kanji',
        due_date: '2026-10-28',
      })
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // AC: Empty quest names are rejected with a friendly message
  it('rejects empty quest titles with a friendly VALIDATION_ERROR', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const milestoneId = await currentMilestoneId(app, token);

    const res = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: milestoneId,
        title: '   ',
        due_date: '2026-10-28',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/little name/i);
  });

  // AC: New quests appear in the sheet and, if due today, on the Today view
  it('creates a quest that shows on GET milestone list and Today when due today', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const milestoneId = await currentMilestoneId(app, token);

    const created = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: milestoneId,
        title: 'Underline three new words',
        due_date: '2026-10-28',
      })
      .expect(201);

    expect(created.body.quest).toMatchObject({
      milestone_id: milestoneId,
      title: 'Underline three new words',
      due_date: '2026-10-28',
      estimated_minutes: null,
      completed_at: null,
    });
    expect(created.body.quest.id).toBeGreaterThan(0);

    const sheet = await request(app)
      .get(`/api/quests?milestone_id=${milestoneId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(sheet.body.milestone.id).toBe(milestoneId);
    expect(sheet.body.quests.some((q: { id: number }) => q.id === created.body.quest.id)).toBe(
      true,
    );

    const today = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(today.body.quests.some((q: { id: number }) => q.id === created.body.quest.id)).toBe(
      true,
    );
  });

  // AC: Each quest in the sheet has a ✕ — deleting incomplete does not change XP
  it('deletes an incomplete quest without changing XP', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const milestoneId = await currentMilestoneId(app, token);

    const created = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: milestoneId,
        title: 'Whisper-read one paragraph',
        due_date: '2026-10-29',
      })
      .expect(201);

    const deleted = await request(app)
      .delete(`/api/quests/${created.body.quest.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ local_date: '2026-10-28' })
      .expect(200);

    expect(deleted.body.ok).toBe(true);
    expect(deleted.body.xp_reversed).toBe(false);
    expect(deleted.body.progress.xp).toBe(0);

    const sheet = await request(app)
      .get(`/api/quests?milestone_id=${milestoneId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(sheet.body.quests.some((q: { id: number }) => q.id === created.body.quest.id)).toBe(
      false,
    );
  });

  // AC: Deleting a completed quest removes the XP it awarded
  it('reverses XP when deleting a completed quest', async () => {
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
      .send({ completed: true, local_date: '2026-10-28' })
      .expect(200);

    const deleted = await request(app)
      .delete(`/api/quests/${questId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ local_date: '2026-10-28' })
      .expect(200);

    expect(deleted.body.ok).toBe(true);
    expect(deleted.body.xp_reversed).toBe(true);
    expect(deleted.body.progress.xp).toBe(0);
    expect(deleted.body.progress.current_streak).toBe(0);
    expect(deleted.body.stamp_card.filled_count).toBe(0);

    const after = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body.quests.some((q: { id: number }) => q.id === questId)).toBe(false);
    expect(after.body.progress.xp).toBe(0);
  });

  it('returns 404 when deleting another user’s quest id', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const res = await request(app)
      .delete('/api/quests/999999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
