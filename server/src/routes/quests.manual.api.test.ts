import {
  CreateQuestResponseSchema,
  DeleteQuestResponseSchema,
  MilestoneQuestsResponseSchema,
} from '@questline/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('Manual quests on Map milestone sheet (Issue #20)', () => {
  let db: Db;
  let currentIso = '2026-11-10T15:00:00.000Z';

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    currentIso = '2026-11-10T15:00:00.000Z';
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, { now: () => new Date(currentIso) });
    await db.query(`DELETE FROM quests`);
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp() {
    return createApp({
      db,
      clock: { now: () => new Date(currentIso) },
      ai: {
        completeChat: vi.fn(async () => 'Chat reply ♡'),
        evaluateInterviewAnswer: vi.fn(),
        proposeGoalDraft: vi.fn(),
        reviseGoalDraft: vi.fn(),
        proposeMilestones: vi.fn(),
        generateDailyQuests: vi.fn(async () => ({ quests: [] })),
      },
    });
  }

  it('adds a manual quest, lists it in GET /api/quests?milestone_id=, and shows it in Today data when due today', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    // 1. Add a manual quest due today (2026-11-10) on milestone 1
    const createRes = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: 1,
        title: '  Write 5 example sentences in my notebook  ',
        due_date: '2026-11-10',
        estimated_minutes: 20,
        local_date: '2026-11-10',
      })
      .expect(201);

    expect(CreateQuestResponseSchema.safeParse(createRes.body).success).toBe(true);
    expect(createRes.body.quest).toMatchObject({
      milestone_id: 1,
      title: 'Write 5 example sentences in my notebook',
      due_date: '2026-11-10',
      estimated_minutes: 20,
      completed_at: null,
    });
    expect(createRes.body.over_daily_budget).toBe(false);

    // 2. Appears in milestone sheet query GET /api/quests?milestone_id=1
    const sheetRes = await request(app)
      .get('/api/quests?milestone_id=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(MilestoneQuestsResponseSchema.safeParse(sheetRes.body).success).toBe(true);
    expect(sheetRes.body.milestone.id).toBe(1);
    expect(sheetRes.body.total_count).toBe(1);
    expect(sheetRes.body.done_count).toBe(0);
    expect(sheetRes.body.quests).toHaveLength(1);
    expect(sheetRes.body.quests[0].title).toBe('Write 5 example sentences in my notebook');

    // 3. Because it is due today (2026-11-10), it appears in the Today data (GET /api/quests?local_date=2026-11-10)
    const todayRes = await request(app)
      .get('/api/quests?local_date=2026-11-10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(todayRes.body.quests).toHaveLength(1);
    expect(todayRes.body.quests[0].id).toBe(createRes.body.quest.id);
    expect(todayRes.body.quests[0].title).toBe('Write 5 example sentences in my notebook');
  });

  it('allows adding a quest that goes over the daily time budget and flags over_daily_budget = true', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    // Demo goal has time_budget_minutes_per_day = 30
    await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: 1,
        title: 'Read chapter 1 aloud',
        due_date: '2026-11-12',
        estimated_minutes: 20,
        local_date: '2026-11-10',
      })
      .expect(201);

    const overRes = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: 1,
        title: 'Review vocabulary flashcards',
        due_date: '2026-11-12',
        estimated_minutes: 25,
        local_date: '2026-11-10',
      })
      .expect(201);

    expect(overRes.body.over_daily_budget).toBe(true);
    expect(overRes.body.daily_minutes_on_due_date).toBe(45);
    expect(overRes.body.time_budget_minutes_per_day).toBe(30);
  });

  it('rejects empty or whitespace-only quest names and past due dates with 400 VALIDATION_ERROR and friendly messages', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    // 1. Whitespace-only title
    const emptyTitleRes = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: 1,
        title: '    ',
        due_date: '2026-11-10',
        local_date: '2026-11-10',
      })
      .expect(400);

    expect(emptyTitleRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(emptyTitleRes.body.error.message).toMatch(/quest|name|title/i);
    expect(emptyTitleRes.body.error.message).not.toContain('[');

    // 2. Past due_date (< local_date)
    const pastDateRes = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: 1,
        title: 'Yesterday task',
        due_date: '2026-11-09',
        local_date: '2026-11-10',
      })
      .expect(400);

    expect(pastDateRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(pastDateRes.body.error.message).toMatch(/today|future|past|date/i);

    // 3. Invalid calendar date
    const fakeDateRes = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: 1,
        title: 'Impossible calendar day',
        due_date: '2026-02-30',
        local_date: '2026-11-10',
      })
      .expect(400);

    expect(fakeDateRes.body.error.code).toBe('VALIDATION_ERROR');

    // 4. Client local_date outside ±1 day of server clock
    const badLocalDateRes = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: 1,
        title: 'Spoofed local date',
        due_date: '2026-11-10',
        local_date: '2026-11-01',
      })
      .expect(400);

    expect(badLocalDateRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('deletes an incomplete quest without changing XP, streak, or stamps', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const createRes = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: 1,
        title: 'Temporary reading task',
        due_date: '2026-11-10',
        local_date: '2026-11-10',
      })
      .expect(201);

    const questId = createRes.body.quest.id as number;

    const delRes = await request(app)
      .delete(`/api/quests/${questId}?local_date=2026-11-10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(DeleteQuestResponseSchema.safeParse(delRes.body).success).toBe(true);
    expect(delRes.body.ok).toBe(true);
    expect(delRes.body.quest.id).toBe(questId);
    expect(delRes.body.xp_reversed).toBe(false);
    expect(delRes.body.progress.xp).toBe(0);
    expect(delRes.body.progress.current_streak).toBe(0);
    expect(delRes.body.stamp_card.filled_count).toBe(0);

    const sheetRes = await request(app)
      .get('/api/quests?milestone_id=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(sheetRes.body.quests).toEqual([]);
  });

  it('deletes a completed quest and reverses its XP, streak, and stamp when it was the only completed quest that day, but keeps the stamp when another completed quest that day remains', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    // Add 2 quests on 2026-11-10
    const q1Res = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: 1,
        title: 'Quest 1 on Nov 10',
        due_date: '2026-11-10',
        local_date: '2026-11-10',
      })
      .expect(201);
    const q1Id = q1Res.body.quest.id as number;

    const q2Res = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: 1,
        title: 'Quest 2 on Nov 10',
        due_date: '2026-11-10',
        local_date: '2026-11-10',
      })
      .expect(201);
    const q2Id = q2Res.body.quest.id as number;

    // Complete both quests on 2026-11-10 -> 20 XP, streak 1, 1 stamp on 2026-11-10
    await request(app)
      .patch(`/api/quests/${q1Id}/completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true, local_date: '2026-11-10' })
      .expect(200);

    const check2 = await request(app)
      .patch(`/api/quests/${q2Id}/completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true, local_date: '2026-11-10' })
      .expect(200);

    expect(check2.body.progress.xp).toBe(20);
    expect(check2.body.progress.current_streak).toBe(1);
    expect(check2.body.stamp_card.stamped_dates).toEqual(['2026-11-10']);

    // 1. Delete Quest 1 while Quest 2 is still completed on 2026-11-10 -> removes 10 XP, keeps stamp and streak
    const del1 = await request(app)
      .delete(`/api/quests/${q1Id}?local_date=2026-11-10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(del1.body.xp_reversed).toBe(true);
    expect(del1.body.progress.xp).toBe(10);
    expect(del1.body.progress.current_streak).toBe(1);
    expect(del1.body.stamp_card.stamped_dates).toEqual(['2026-11-10']);

    // 2. Delete Quest 2 (the only remaining completed quest on 2026-11-10) -> removes 10 XP, removes stamp, reverts streak to 0
    const del2 = await request(app)
      .delete(`/api/quests/${q2Id}?local_date=2026-11-10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(del2.body.xp_reversed).toBe(true);
    expect(del2.body.progress.xp).toBe(0);
    expect(del2.body.progress.current_streak).toBe(0);
    expect(del2.body.progress.last_active_date).toBeNull();
    expect(del2.body.stamp_card.stamped_dates).toEqual([]);
    expect(del2.body.stamp_card.filled_count).toBe(0);
  });

  it('reverses only XP and keeps today’s stamp and streak when deleting an old completed quest with null completed_local_date', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    // 1. Create and complete a quest today (2026-11-10) so today has a stamp and streak = 1
    const todayQuestRes = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_id: 1,
        title: 'Today completed quest',
        due_date: '2026-11-10',
        local_date: '2026-11-10',
      })
      .expect(201);
    const todayQuestId = todayQuestRes.body.quest.id as number;

    await request(app)
      .patch(`/api/quests/${todayQuestId}/completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true, local_date: '2026-11-10' })
      .expect(200);

    //Wait: also test when the legacy quest is the ONLY quest in DB, while today has a stamp!
    // Delete todayQuest row directly or keep a stamp for 2026-11-10 with no other completed_local_date='2026-11-10'
    await db.query(`DELETE FROM quests WHERE id = $1`, [todayQuestId]);

    // Insert a legacy completed quest (completed before #13, so completed_local_date IS NULL)
    // and ensure user has 20 XP, current_streak = 1, last_active_date = '2026-11-10', and a stamp on '2026-11-10'
    const legacyInsert = await db.query<{ id: number }>(
      `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at, completed_local_date)
       VALUES (1, 'Legacy completed quest', '2026-11-05', 15, '2026-11-05T12:00:00Z', NULL)
       RETURNING id`,
    );
    const legacyQuestId = legacyInsert.rows[0].id;
    await db.query(`UPDATE user_progress SET xp = 20, current_streak = 1, best_streak = 1, last_active_date = '2026-11-10', active_day_completions = 1 WHERE user_id = 1`);

    // Delete the legacy completed quest (completed_local_date is NULL)
    const delLegacy = await request(app)
      .delete(`/api/quests/${legacyQuestId}?local_date=2026-11-10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // XP is reversed (20 -> 10), but today's stamp (2026-11-10) and streak (1) stay untouched!
    expect(delLegacy.body.xp_reversed).toBe(true);
    expect(delLegacy.body.progress.xp).toBe(10);
    expect(delLegacy.body.progress.current_streak).toBe(1);
    expect(delLegacy.body.progress.last_active_date).toBe('2026-11-10');
    expect(delLegacy.body.stamp_card.stamped_dates).toEqual(['2026-11-10']);
    expect(delLegacy.body.stamp_card.filled_count).toBe(1);
  });

  it('returns 404 NOT_FOUND when listing, adding, or deleting on another user’s milestone/quest or a non-active goal', async () => {
    const app = buildApp();
    const demoToken = await loginAsDemo(app);

    // Demo user creates a quest on milestone 1
    const demoQuestRes = await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${demoToken}`)
      .send({
        milestone_id: 1,
        title: 'Demo user quest',
        due_date: '2026-11-10',
        local_date: '2026-11-10',
      })
      .expect(201);
    const demoQuestId = demoQuestRes.body.quest.id as number;

    // Register a second user
    const otherReg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@questline.local', password: 'other-password-123' })
      .expect(201);
    const otherToken = otherReg.body.token as string;

    // 1. Other user cannot list demo user's milestone quests -> 404
    await request(app)
      .get('/api/quests?milestone_id=1')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    // 2. Other user cannot add a quest to demo user's milestone -> 404
    await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        milestone_id: 1,
        title: 'Intruder quest',
        due_date: '2026-11-10',
        local_date: '2026-11-10',
      })
      .expect(404);

    // 3. Other user cannot delete demo user's quest -> 404
    await request(app)
      .delete(`/api/quests/${demoQuestId}?local_date=2026-11-10`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    // 4. Pause demo user's goal so it is no longer active -> adding or deleting on a paused goal returns 404
    await db.query(`UPDATE goals SET status = 'paused' WHERE id = 1`);

    await request(app)
      .get('/api/quests?milestone_id=1')
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(404);

    await request(app)
      .post('/api/quests')
      .set('Authorization', `Bearer ${demoToken}`)
      .send({
        milestone_id: 1,
        title: 'Quest on paused goal',
        due_date: '2026-11-10',
        local_date: '2026-11-10',
      })
      .expect(404);

    await request(app)
      .delete(`/api/quests/${demoQuestId}?local_date=2026-11-10`)
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(404);
  });
});
