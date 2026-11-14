import type { ProposedQuest } from '@questline/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatAiClient } from '../ai/client.js';
import { createApp } from '../app.js';
import type { Clock } from '../clock.js';
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

const sampleGeneratedQuests: ProposedQuest[] = [
  {
    title: 'Read 2 pages of your graded reader slowly',
    due_date: '2026-11-10',
    estimated_minutes: 15,
  },
  {
    title: 'Jot down 3 new vocabulary words from today',
    due_date: '2026-11-10',
    estimated_minutes: 15,
  },
  {
    title: 'Read the next 2 pages and underline particles',
    due_date: '2026-11-11',
    estimated_minutes: 20,
  },
  {
    title: 'Review yesterday’s 3 words out loud',
    due_date: '2026-11-11',
    estimated_minutes: 10,
  },
  {
    title: 'Finish the short story section and summarize in 1 sentence',
    due_date: '2026-11-12',
    estimated_minutes: 25,
  },
];

describe('GET /api/quests & POST /api/quests/generate (Issue #7)', () => {
  let db: Db;
  const clock = fixedClock('2026-11-10T15:00:00.000Z');
  let generateDailyQuests: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, clock);
    // Clear seeded demo quests so each test starts with an active goal + current milestone and 0 quests.
    await db.query(`DELETE FROM quests`);

    generateDailyQuests = vi.fn(async () => ({
      quests: sampleGeneratedQuests,
    }));
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp(ai?: ChatAiClient) {
    return createApp({
      db,
      clock,
      ai: ai ?? {
        completeChat: vi.fn(async () => 'Chat reply ♡'),
        evaluateInterviewAnswer: vi.fn(),
        proposeGoalDraft: vi.fn(),
        reviseGoalDraft: vi.fn(),
        proposeMilestones: vi.fn(),
        generateDailyQuests,
      },
    });
  }

  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    const app = buildApp();
    await request(app).get('/api/quests').expect(401);
    await request(app).post('/api/quests/generate').send({}).expect(401);
  });

  it('GET /api/quests is read-only and returns empty quests when none are saved yet without calling AI', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const res = await request(app)
      .get('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(generateDailyQuests).not.toHaveBeenCalled();
    expect(res.body.goal.title).toBe('Read a Japanese novel on my own');
    expect(res.body.milestone.title).toBe('Build a tiny daily reading habit');
    expect(res.body.milestone.status).toBe('current');
    expect(res.body.window_start).toBe('2026-11-10');
    expect(res.body.window_end).toBe('2026-11-12');
    expect(res.body.quests).toEqual([]);
  });

  // AC: Quests are generated for the current milestone only, saved, and not regenerated on reload
  it('POST /api/quests/generate generates and saves quests for the current milestone only once', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    // Add an upcoming milestone to verify quests are generated ONLY for the current milestone
    await db.query(
      `INSERT INTO milestones (goal_id, position, title, description, target_date, status)
       VALUES ($1, 2, 'Upcoming stage 2', 'Later stage', '2027-02-01', 'upcoming')`,
      [1],
    );

    const firstGen = await request(app)
      .post('/api/quests/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    expect(generateDailyQuests).toHaveBeenCalledTimes(1);
    expect(firstGen.body.milestone.status).toBe('current');
    expect(firstGen.body.quests).toHaveLength(sampleGeneratedQuests.length);
    for (const q of firstGen.body.quests) {
      expect(q.milestone_id).toBe(firstGen.body.milestone.id);
    }

    // Second POST /api/quests/generate does NOT call AI or insert duplicate rows
    const secondGen = await request(app)
      .post('/api/quests/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    expect(generateDailyQuests).toHaveBeenCalledTimes(1);
    expect(secondGen.body.quests).toHaveLength(sampleGeneratedQuests.length);

    // GET /api/quests returns the exact saved quests
    const getRes = await request(app)
      .get('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getRes.body.quests).toEqual(firstGen.body.quests);
  });

  // Rule: Safe against two requests at once (transaction + FOR UPDATE lock)
  it('prevents duplicate quests when two POST /api/quests/generate requests run concurrently', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const [resA, resB] = await Promise.all([
      request(app).post('/api/quests/generate').set('Authorization', `Bearer ${token}`).send({}),
      request(app).post('/api/quests/generate').set('Authorization', `Bearer ${token}`).send({}),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(generateDailyQuests).toHaveBeenCalledTimes(1);
    expect(resA.body.quests).toHaveLength(sampleGeneratedQuests.length);
    expect(resB.body.quests).toHaveLength(sampleGeneratedQuests.length);

    const dbCount = await db.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM quests`);
    expect(dbCount.rows[0].c).toBe(sampleGeneratedQuests.length);
  });

  // Rule: If the goal's time_budget_minutes_per_day is null, use a default of 30 minutes
  it('uses a default time budget of 30 minutes when goal.time_budget_minutes_per_day is null', async () => {
    await db.query(`UPDATE goals SET time_budget_minutes_per_day = NULL`);

    const app = buildApp();
    const token = await loginAsDemo(app);

    await request(app)
      .post('/api/quests/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    expect(generateDailyQuests).toHaveBeenCalledWith(
      expect.objectContaining({
        timeBudgetMinutesPerDay: 30,
      }),
    );
  });

  // AC: Validate the AI's quests with Zod; handle invalid AI output gracefully
  it('returns 503 AI_UNAVAILABLE and saves nothing when AI output exceeds daily budget or milestone target_date', async () => {
    generateDailyQuests.mockResolvedValueOnce({
      quests: [
        {
          title: 'Too long session 1',
          due_date: '2026-11-10',
          estimated_minutes: 20,
        },
        {
          title: 'Too long session 2 (total 40 > 30)',
          due_date: '2026-11-10',
          estimated_minutes: 20,
        },
      ],
    });

    const app = buildApp();
    const token = await loginAsDemo(app);

    const overBudgetRes = await request(app)
      .post('/api/quests/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(503);

    expect(overBudgetRes.body.error.code).toBe('AI_UNAVAILABLE');

    const dbCount = await db.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM quests`);
    expect(dbCount.rows[0].c).toBe(0);
  });

  // Rule: Filter everything by user_id
  it('isolates quests by user_id so another user cannot see or generate for the demo user goal', async () => {
    const app = buildApp();
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@questline.local', password: 'other-password-123' })
      .expect(201);
    const otherToken = registerRes.body.token as string;

    const getRes = await request(app)
      .get('/api/quests')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);

    expect(getRes.body.goal).toBeNull();
    expect(getRes.body.milestone).toBeNull();
    expect(getRes.body.quests).toEqual([]);

    await request(app)
      .post('/api/quests/generate')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({})
      .expect(404);
  });

  it('normalizes a free-text goal deadline to YYYY-MM-DD or null in GET /api/quests and POST /api/quests/generate so CurrentMilestoneQuestsResponseSchema passes', async () => {
    const { CurrentMilestoneQuestsResponseSchema } = await import('@questline/shared');
    const app = buildApp();
    const token = await loginAsDemo(app);

    // 1. Free-text deadline with no embedded date -> normalized to null
    await db.query(`UPDATE goals SET deadline = 'One year from now'`);

    const getFreeTextRes = await request(app)
      .get('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getFreeTextRes.body.goal.deadline).toBeNull();
    expect(CurrentMilestoneQuestsResponseSchema.safeParse(getFreeTextRes.body).success).toBe(true);

    const genFreeTextRes = await request(app)
      .post('/api/quests/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    expect(genFreeTextRes.body.goal.deadline).toBeNull();
    expect(CurrentMilestoneQuestsResponseSchema.safeParse(genFreeTextRes.body).success).toBe(true);

    // 2. Free-text deadline containing an embedded YYYY-MM-DD -> extracted to clean YYYY-MM-DD
    await db.query(`UPDATE goals SET deadline = 'by 2027-11-12, about one year from now'`);

    const getEmbeddedRes = await request(app)
      .get('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getEmbeddedRes.body.goal.deadline).toBe('2027-11-12');
    expect(CurrentMilestoneQuestsResponseSchema.safeParse(getEmbeddedRes.body).success).toBe(true);
  });

  describe('PATCH /api/quests/:questId/completion (Issue #9)', () => {
    it('checks off a quest using the server clock, persists after reload, and allows undoing back to null', async () => {
      const { ToggleQuestCompletionResponseSchema } = await import('@questline/shared');
      const app = buildApp();
      const token = await loginAsDemo(app);

      const genRes = await request(app)
        .post('/api/quests/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const firstQuestId = genRes.body.quests[0].id as number;
      expect(genRes.body.quests[0].completed_at).toBeNull();

      // 1. Check off the quest (ignoring any client-supplied completed_at)
      const checkRes = await request(app)
        .patch(`/api/quests/${firstQuestId}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true, completed_at: '1999-01-01T00:00:00.000Z' })
        .expect(200);

      expect(ToggleQuestCompletionResponseSchema.safeParse(checkRes.body).success).toBe(true);
      expect(checkRes.body.quest.id).toBe(firstQuestId);
      expect(checkRes.body.quest.completed_at).toBe('2026-11-10T15:00:00Z');
      expect(checkRes.body.progress.xp).toBe(10);
      expect(checkRes.body.leveled_up).toBe(false);

      // 2. Verify persistence on reload via GET /api/quests
      const reloadRes = await request(app)
        .get('/api/quests')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const reloadedQuest = reloadRes.body.quests.find(
        (q: { id: number }) => q.id === firstQuestId,
      );
      expect(reloadedQuest.completed_at).toBe('2026-11-10T15:00:00Z');
      expect(reloadRes.body.milestone.done_quests).toBe(1);

      // 3. Undo check-off (completed: false) -> resets completed_at to null
      const undoRes = await request(app)
        .patch(`/api/quests/${firstQuestId}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: false })
        .expect(200);

      expect(undoRes.body.quest.id).toBe(firstQuestId);
      expect(undoRes.body.quest.completed_at).toBeNull();
      expect(undoRes.body.progress.xp).toBe(0);

      // 4. Verify undo persists on reload
      const reloadAfterUndo = await request(app)
        .get('/api/quests')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const undoneQuest = reloadAfterUndo.body.quests.find(
        (q: { id: number }) => q.id === firstQuestId,
      );
      expect(undoneQuest.completed_at).toBeNull();
      expect(reloadAfterUndo.body.milestone.done_quests).toBe(0);
    });

    it('returns 404 NOT_FOUND when a user tries to toggle another user’s quest or a nonexistent quest', async () => {
      const app = buildApp();
      const demoToken = await loginAsDemo(app);

      const genRes = await request(app)
        .post('/api/quests/generate')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({})
        .expect(200);

      const demoQuestId = genRes.body.quests[0].id as number;

      // Register a second user
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ email: 'intruder@questline.local', password: 'intruder-password-123' })
        .expect(201);
      const otherToken = registerRes.body.token as string;

      // Other user cannot check off demo user's quest -> 404
      const otherUserPatch = await request(app)
        .patch(`/api/quests/${demoQuestId}/completion`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ completed: true })
        .expect(404);

      expect(otherUserPatch.body.error.code).toBe('NOT_FOUND');

      // Demo user's quest remains untouched
      const reloadRes = await request(app)
        .get('/api/quests')
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);
      expect(reloadRes.body.quests[0].completed_at).toBeNull();

      // Nonexistent quest ID -> 404
      const missingRes = await request(app)
        .patch('/api/quests/999999/completion')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({ completed: true })
        .expect(404);

      expect(missingRes.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 VALIDATION_ERROR for an invalid request body or invalid questId param', async () => {
      const app = buildApp();
      const token = await loginAsDemo(app);

      const genRes = await request(app)
        .post('/api/quests/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const questId = genRes.body.quests[0].id as number;

      // Missing `completed`
      const emptyBodyRes = await request(app)
        .patch(`/api/quests/${questId}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
      expect(emptyBodyRes.body.error.code).toBe('VALIDATION_ERROR');

      // Non-boolean `completed`
      const stringBodyRes = await request(app)
        .patch(`/api/quests/${questId}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: 'yes' })
        .expect(400);
      expect(stringBodyRes.body.error.code).toBe('VALIDATION_ERROR');

      // Non-integer questId
      const badParamRes = await request(app)
        .patch('/api/quests/not-a-number/completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true })
        .expect(400);
      expect(badParamRes.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('validates local_date across GET /api/quests, POST /api/quests/generate, and PATCH /api/quests/:questId/completion (real date within ±1 day of server clock)', async () => {
      const app = buildApp();
      const token = await loginAsDemo(app);

      // ±1 day of server date (2026-11-10) is accepted
      const prevDayGet = await request(app)
        .get('/api/quests?local_date=2026-11-09')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(prevDayGet.body.window_start).toBe('2026-11-09');

      const nextDayGet = await request(app)
        .get('/api/quests?local_date=2026-11-11')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(nextDayGet.body.window_start).toBe('2026-11-11');

      // Non-existent calendar date (2026-02-30) -> 400 VALIDATION_ERROR
      const fakeDateGet = await request(app)
        .get('/api/quests?local_date=2026-02-30')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(fakeDateGet.body.error.code).toBe('VALIDATION_ERROR');

      // Date >1 day away from server clock (2026-11-10) -> 400 VALIDATION_ERROR
      const farDateGet = await request(app)
        .get('/api/quests?local_date=2026-11-05')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(farDateGet.body.error.code).toBe('VALIDATION_ERROR');

      const farDateGen = await request(app)
        .post('/api/quests/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ local_date: '2026-11-20' })
        .expect(400);
      expect(farDateGen.body.error.code).toBe('VALIDATION_ERROR');

      const genRes = await request(app)
        .post('/api/quests/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ local_date: '2026-11-10' })
        .expect(200);
      const questId = genRes.body.quests[0].id as number;

      const farDatePatch = await request(app)
        .patch(`/api/quests/${questId}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true, local_date: '2026-11-01' })
        .expect(400);
      expect(farDatePatch.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
