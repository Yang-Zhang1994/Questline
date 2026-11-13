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
});
