import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeekPlanDraft } from '@questline/shared';
import type { Clock } from '../clock.js';
import { createApp } from '../app.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { seedDemoDataIfEmpty } from '../db/seed.js';
import { stubAi } from '../test/aiStub.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

async function registerFresh(app: ReturnType<typeof createApp>, email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'fresh-password-123' })
    .expect(201);
  return res.body.token as string;
}

describe('GET/POST /api/quests/week-plan (Issue #15)', () => {
  let db: Db;
  const iso = '2026-11-09T15:00:00.000Z';
  const today = '2026-11-09';
  const clock = fixedClock(iso);
  let proposeWeekPlan: ReturnType<typeof vi.fn>;
  let reviseWeekPlan: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, clock);
    proposeWeekPlan = vi.fn();
    reviseWeekPlan = vi.fn();
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp() {
    return createApp({
      db,
      clock,
      ai: stubAi({ proposeWeekPlan, reviseWeekPlan }),
    });
  }

  async function seedGoalWithQuests(email: string): Promise<{
    goalId: number;
    milestoneId: number;
    existingCount: number;
  }> {
    const user = await db.query<{ id: number }>(`SELECT id FROM users WHERE email = $1`, [email]);
    const userId = user.rows[0].id;
    const goal = await db.query<{ id: number }>(
      `INSERT INTO goals (
         user_id, title, done_definition, starting_point,
         time_budget_minutes_per_day, deadline, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING id`,
      [
        userId,
        'Read a Japanese novel on my own',
        'Finish one short Japanese novel',
        'Know hiragana',
        20,
        '2027-11-09',
        iso,
      ],
    );
    const milestone = await db.query<{ id: number }>(
      `INSERT INTO milestones (goal_id, position, title, description, target_date, status)
       VALUES ($1, 1, $2, $3, $4, 'current')
       RETURNING id`,
      [
        goal.rows[0].id,
        'Build a tiny daily reading habit',
        'Read a few pages each day',
        '2026-11-16',
      ],
    );
    const mid = milestone.rows[0].id;
    await db.query(
      `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at)
       VALUES ($1, $2, $3, 10, NULL)`,
      [mid, 'Read 2 pages of your graded reader', today],
    );
    await db.query(
      `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at)
       VALUES ($1, $2, $3, 10, $4)`,
      [mid, 'Write down 3 new words', '2026-11-08', iso],
    );
    return {
      goalId: goal.rows[0].id,
      milestoneId: mid,
      existingCount: 2,
    };
  }

  function sampleDraft(): WeekPlanDraft {
    return {
      week_start: '2026-11-09',
      week_end: '2026-11-15',
      quests: [
        {
          title: 'Soft review of yesterday notes',
          due_date: '2026-11-09',
          estimated_minutes: 10,
        },
        {
          title: 'Read one cozy paragraph aloud',
          due_date: '2026-11-10',
          estimated_minutes: 10,
        },
        {
          title: 'Circle three helpful words',
          due_date: '2026-11-11',
          estimated_minutes: 10,
        },
      ],
      mochi_message: "Here's a gentle week of tiny steps.",
    };
  }

  it('rejects missing Bearer token with UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/quests/week-plan').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // AC: User can ask Mochi to plan the next 7 days; save only on confirm
  it('proposes a draft without inserting quests, then confirms inserts', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'week-plan-flow@questline.test');
    const { goalId, milestoneId, existingCount } = await seedGoalWithQuests(
      'week-plan-flow@questline.test',
    );
    const sample = sampleDraft();
    proposeWeekPlan.mockResolvedValue(sample);

    const draftRes = await request(app)
      .post('/api/quests/week-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ local_date: today })
      .expect(201);

    expect(draftRes.body.draft.quests).toHaveLength(3);
    expect(draftRes.body.draft.week_start).toBe('2026-11-09');
    expect(draftRes.body.draft.week_end).toBe('2026-11-15');
    expect(draftRes.body.existing_quests).toHaveLength(existingCount);
    expect(draftRes.body.draft.mochi_message).toMatch(/gentle week/i);
    expect(proposeWeekPlan).toHaveBeenCalledTimes(1);

    // No new rows until confirm.
    const before = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM quests WHERE milestone_id = $1`,
      [milestoneId],
    );
    expect(Number(before.rows[0].n)).toBe(existingCount);

    const stored = await db.query<{ week_plan_draft: WeekPlanDraft }>(
      `SELECT week_plan_draft FROM goals WHERE id = $1`,
      [goalId],
    );
    expect(stored.rows[0].week_plan_draft).toBeTruthy();

    const confirm = await request(app)
      .post('/api/quests/week-plan/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ draft: sample, local_date: today })
      .expect(201);

    expect(confirm.body.quests).toHaveLength(3);
    expect(confirm.body.mochi_message).toMatch(/gentle week/i);

    const after = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM quests WHERE milestone_id = $1`,
      [milestoneId],
    );
    expect(Number(after.rows[0].n)).toBe(existingCount + 3);

    const cleared = await db.query<{ week_plan_draft: unknown }>(
      `SELECT week_plan_draft FROM goals WHERE id = $1`,
      [goalId],
    );
    expect(cleared.rows[0].week_plan_draft).toBeNull();
  });

  // AC: Plan accounts for already-scheduled quests with no duplicates
  it('rejects a draft that duplicates an existing title on the same day', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'week-dup@questline.test');
    await seedGoalWithQuests('week-dup@questline.test');
    proposeWeekPlan.mockResolvedValue({
      week_start: '2026-11-09',
      week_end: '2026-11-15',
      quests: [
        {
          title: 'Read 2 pages of your graded reader',
          due_date: '2026-11-09',
          estimated_minutes: 5,
        },
      ],
      mochi_message: 'Oops duplicate.',
    });

    const res = await request(app)
      .post('/api/quests/week-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ local_date: today })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(proposeWeekPlan).toHaveBeenCalledTimes(1);
  });

  // AC: User can ask Mochi for changes
  it('revises a draft without writing quests until confirm', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'week-revise@questline.test');
    const { milestoneId, existingCount } = await seedGoalWithQuests('week-revise@questline.test');
    const first = sampleDraft();
    const second: WeekPlanDraft = {
      ...first,
      quests: [
        { ...first.quests[0], title: 'Lighter soft review' },
        first.quests[1],
      ],
      mochi_message: "Here's a gentler week of tiny steps.",
    };
    proposeWeekPlan.mockResolvedValue(first);
    reviseWeekPlan.mockResolvedValue(second);

    await request(app)
      .post('/api/quests/week-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ local_date: today })
      .expect(201);

    const revised = await request(app)
      .post('/api/quests/week-plan/revise')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedback: 'lighter tomorrow', local_date: today })
      .expect(200);

    expect(revised.body.draft.quests[0].title).toMatch(/Lighter soft review/i);
    expect(reviseWeekPlan).toHaveBeenCalledTimes(1);

    const stillSame = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM quests WHERE milestone_id = $1`,
      [milestoneId],
    );
    expect(Number(stillSame.rows[0].n)).toBe(existingCount);
  });
});
