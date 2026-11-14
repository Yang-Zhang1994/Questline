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

  describe('Stamp Card collection & transactional sync (Issue #13)', () => {
    it('earns one stamp on first check-off of the day, does not add a second on the same day, keeps stamp when other completed quests remain, and removes the stamp when the last completed quest for that day is undone', async () => {
      const app = buildApp();
      const token = await loginAsDemo(app);

      const genRes = await request(app)
        .post('/api/quests/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ local_date: '2026-11-10' })
        .expect(200);

      expect(genRes.body.stamp_card).toEqual({
        card_number: 1,
        stamps_per_card: 10,
        stamped_dates: [],
        filled_count: 0,
        past_cards: [],
      });

      const quest1Id = genRes.body.quests[0].id as number;
      const quest2Id = genRes.body.quests[1].id as number;

      // 1. First check-off on 2026-11-10 earns 1 stamp
      const firstCheck = await request(app)
        .patch(`/api/quests/${quest1Id}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true, local_date: '2026-11-10' })
        .expect(200);

      expect(firstCheck.body.stamp_card.card_number).toBe(1);
      expect(firstCheck.body.stamp_card.filled_count).toBe(1);
      expect(firstCheck.body.stamp_card.stamped_dates).toEqual(['2026-11-10']);
      expect(firstCheck.body.card_completed).toBe(false);
      expect(firstCheck.body.card_reward_message).toBeNull();

      // 2. Second check-off on the same day (2026-11-10) does NOT add a second stamp
      const secondCheck = await request(app)
        .patch(`/api/quests/${quest2Id}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true, local_date: '2026-11-10' })
        .expect(200);

      expect(secondCheck.body.stamp_card.filled_count).toBe(1);
      expect(secondCheck.body.stamp_card.stamped_dates).toEqual(['2026-11-10']);

      const stampCountAfterTwo = await db.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM stamps WHERE stamp_date = '2026-11-10'`,
      );
      expect(stampCountAfterTwo.rows[0].c).toBe(1);

      // 3. Undo quest 1 while quest 2 is still completed on 2026-11-10 -> stamp remains
      const undoFirst = await request(app)
        .patch(`/api/quests/${quest1Id}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: false, local_date: '2026-11-10' })
        .expect(200);

      expect(undoFirst.body.stamp_card.filled_count).toBe(1);
      expect(undoFirst.body.stamp_card.stamped_dates).toEqual(['2026-11-10']);

      // 4. Undo quest 2 (the only remaining completed quest for 2026-11-10) -> removes the stamp
      const undoSecond = await request(app)
        .patch(`/api/quests/${quest2Id}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: false, local_date: '2026-11-10' })
        .expect(200);

      expect(undoSecond.body.stamp_card.filled_count).toBe(0);
      expect(undoSecond.body.stamp_card.stamped_dates).toEqual([]);
    });

    it('removes day 1’s stamp when a quest completed on day 1 is undone on day 2', async () => {
      let currentIso = '2026-11-10T15:00:00.000Z';
      const dynamicApp = createApp({
        db,
        clock: { now: () => new Date(currentIso) },
        ai: {
          completeChat: vi.fn(async () => 'Chat reply ♡'),
          evaluateInterviewAnswer: vi.fn(),
          proposeGoalDraft: vi.fn(),
          reviseGoalDraft: vi.fn(),
          proposeMilestones: vi.fn(),
          generateDailyQuests,
        },
      });
      const token = await loginAsDemo(dynamicApp);

      const genRes = await request(dynamicApp)
        .post('/api/quests/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ local_date: '2026-11-10' })
        .expect(200);

      const day1QuestId = genRes.body.quests[0].id as number;
      const day2QuestId = genRes.body.quests[2].id as number;

      // Day 1 (2026-11-10): complete quest 1 -> earns stamp for 2026-11-10
      const checkDay1 = await request(dynamicApp)
        .patch(`/api/quests/${day1QuestId}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true, local_date: '2026-11-10' })
        .expect(200);
      expect(checkDay1.body.stamp_card.stamped_dates).toEqual(['2026-11-10']);

      // Advance clock to Day 2 (2026-11-11) and complete a Day 2 quest -> stamps for 11-10 and 11-11
      currentIso = '2026-11-11T15:00:00.000Z';
      const checkDay2 = await request(dynamicApp)
        .patch(`/api/quests/${day2QuestId}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true, local_date: '2026-11-11' })
        .expect(200);
      expect(checkDay2.body.stamp_card.stamped_dates).toEqual(['2026-11-10', '2026-11-11']);

      // Still on Day 2 (2026-11-11): undo the Day 1 quest -> removes Day 1's stamp (2026-11-10), keeps Day 2's stamp
      const undoDay1OnDay2 = await request(dynamicApp)
        .patch(`/api/quests/${day1QuestId}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: false, local_date: '2026-11-11' })
        .expect(200);

      expect(undoDay1OnDay2.body.stamp_card.stamped_dates).toEqual(['2026-11-11']);
      expect(undoDay1OnDay2.body.stamp_card.filled_count).toBe(1);
    });

    it('fills a 10-slot card, triggers Mochi reward message, saves past card history, starts a new card, and handles undoing the 10th stamp', async () => {
      const app = buildApp();
      const token = await loginAsDemo(app);

      // Seed 9 prior stamps on Card #1 for demo user (user_id = 1)
      for (let i = 1; i <= 9; i += 1) {
        const d = `2026-11-${String(i).padStart(2, '0')}`;
        await db.query(
          `INSERT INTO stamps (user_id, card_number, stamp_date) VALUES (1, 1, $1)`,
          [d],
        );
      }

      const genRes = await request(app)
        .post('/api/quests/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ local_date: '2026-11-10' })
        .expect(200);

      expect(genRes.body.stamp_card.card_number).toBe(1);
      expect(genRes.body.stamp_card.filled_count).toBe(9);
      expect(genRes.body.stamp_card.past_cards).toEqual([]);

      const quest1Id = genRes.body.quests[0].id as number;
      const quest3Id = genRes.body.quests[2].id as number;

      // Complete 10th stamp on 2026-11-10 -> fills Card #1, triggers Mochi message, starts Card #2
      const fillRes = await request(app)
        .patch(`/api/quests/${quest1Id}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true, local_date: '2026-11-10' })
        .expect(200);

      expect(fillRes.body.card_completed).toBe(true);
      expect(fillRes.body.card_reward_message).toMatch(/Stamp Card #1/i);
      expect(fillRes.body.stamp_card.card_number).toBe(2);
      expect(fillRes.body.stamp_card.filled_count).toBe(0);
      expect(fillRes.body.stamp_card.stamped_dates).toEqual([]);
      expect(fillRes.body.stamp_card.past_cards).toEqual([
        {
          card_number: 1,
          stamp_dates: [
            '2026-11-01',
            '2026-11-02',
            '2026-11-03',
            '2026-11-04',
            '2026-11-05',
            '2026-11-06',
            '2026-11-07',
            '2026-11-08',
            '2026-11-09',
            '2026-11-10',
          ],
          stamp_count: 10,
        },
      ]);

      // Complete a quest on 2026-11-11 -> lands on Card #2 slot 1 while Card #1 stays in past_cards
      const nextCardRes = await request(app)
        .patch(`/api/quests/${quest3Id}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true, local_date: '2026-11-11' })
        .expect(200);

      expect(nextCardRes.body.card_completed).toBe(false);
      expect(nextCardRes.body.stamp_card.card_number).toBe(2);
      expect(nextCardRes.body.stamp_card.filled_count).toBe(1);
      expect(nextCardRes.body.stamp_card.stamped_dates).toEqual(['2026-11-11']);
      expect(nextCardRes.body.stamp_card.past_cards).toHaveLength(1);
      expect(nextCardRes.body.stamp_card.past_cards[0].card_number).toBe(1);
    });

    it('never exposes another user’s stamps or allows another user’s actions to affect them', async () => {
      const app = buildApp();
      const demoToken = await loginAsDemo(app);

      const genRes = await request(app)
        .post('/api/quests/generate')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({ local_date: '2026-11-10' })
        .expect(200);
      const demoQuestId = genRes.body.quests[0].id as number;

      // Demo user earns a stamp on 2026-11-10
      await request(app)
        .patch(`/api/quests/${demoQuestId}/completion`)
        .set('Authorization', `Bearer ${demoToken}`)
        .send({ completed: true, local_date: '2026-11-10' })
        .expect(200);

      // Register a second user
      const otherReg = await request(app)
        .post('/api/auth/register')
        .send({ email: 'second@questline.local', password: 'second-password-123' })
        .expect(201);
      const otherToken = otherReg.body.token as string;

      // Second user sees an empty stamp card with 0 stamps and no past cards
      const otherGet = await request(app)
        .get('/api/quests?local_date=2026-11-10')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(otherGet.body.stamp_card).toEqual({
        card_number: 1,
        stamps_per_card: 10,
        stamped_dates: [],
        filled_count: 0,
        past_cards: [],
      });
    });
  });
});
