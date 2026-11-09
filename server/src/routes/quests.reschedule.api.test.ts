import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RescheduleDraft } from '@questline/shared';
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

describe('GET/POST /api/quests/reschedule (Issue #14)', () => {
  let db: Db;
  const iso = '2026-11-09T15:00:00.000Z';
  const today = '2026-11-09';
  const clock = fixedClock(iso);
  let proposeReschedule: ReturnType<typeof vi.fn>;
  let reviseReschedule: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, clock);
    proposeReschedule = vi.fn();
    reviseReschedule = vi.fn();
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp() {
    return createApp({
      db,
      clock,
      ai: stubAi({ proposeReschedule, reviseReschedule }),
    });
  }

  async function seedGoalWithOverdue(email: string): Promise<{
    goalId: number;
    milestoneId: number;
    overdueIds: number[];
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
    const q1 = await db.query<{ id: number }>(
      `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at)
       VALUES ($1, $2, $3, 10, NULL) RETURNING id`,
      [mid, 'Read 2 pages of your graded reader', '2026-11-05'],
    );
    const q2 = await db.query<{ id: number }>(
      `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at)
       VALUES ($1, $2, $3, 10, NULL) RETURNING id`,
      [mid, 'Write down 3 new words', '2026-11-06'],
    );
    // Today quest — not overdue.
    await db.query(
      `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at)
       VALUES ($1, $2, $3, 10, NULL)`,
      [mid, 'Say one sentence out loud', today],
    );
    return {
      goalId: goal.rows[0].id,
      milestoneId: mid,
      overdueIds: [q1.rows[0].id, q2.rows[0].id],
    };
  }

  function draftFor(ids: number[]): RescheduleDraft {
    return {
      moves: [
        {
          quest_id: ids[0],
          title: 'Read 2 pages of your graded reader',
          from_date: '2026-11-05',
          to_date: '2026-11-09',
          estimated_minutes: 10,
        },
        {
          quest_id: ids[1],
          title: 'Write down 3 new words',
          from_date: '2026-11-06',
          to_date: '2026-11-10',
          estimated_minutes: 10,
        },
      ],
      mochi_message: "Let's adjust the plan together.",
    };
  }

  it('rejects missing Bearer token with UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/quests/reschedule').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // AC: Overdue quests are flagged via Today + reschedule GET
  it('lists overdue quests on Today and in the reschedule endpoint', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'overdue-list@questline.test');
    const { overdueIds } = await seedGoalWithOverdue('overdue-list@questline.test');

    const todayRes = await request(app)
      .get(`/api/quests/today?local_date=${today}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(todayRes.body.overdue_quests).toHaveLength(2);
    expect(todayRes.body.overdue_quests.map((q: { id: number }) => q.id)).toEqual(overdueIds);
    expect(todayRes.body.quests).toHaveLength(1);

    const plan = await request(app)
      .get(`/api/quests/reschedule?local_date=${today}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(plan.body.overdue).toHaveLength(2);
    expect(plan.body.draft).toBeNull();
  });

  // AC: User can ask Mochi to reschedule; preview saved only after confirm
  it('proposes a draft without rewriting due dates, then confirms updates', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'reschedule-flow@questline.test');
    const { overdueIds, goalId } = await seedGoalWithOverdue('reschedule-flow@questline.test');
    const sample = draftFor(overdueIds);
    proposeReschedule.mockResolvedValue(sample);

    const draftRes = await request(app)
      .post('/api/quests/reschedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ local_date: today })
      .expect(201);

    expect(draftRes.body.draft.moves).toHaveLength(2);
    expect(draftRes.body.draft.mochi_message).toMatch(/adjust the plan together/i);
    expect(proposeReschedule).toHaveBeenCalledTimes(1);

    // Due dates unchanged until confirm.
    const before = await db.query<{ due_date: string }>(
      `SELECT due_date FROM quests WHERE id = $1`,
      [overdueIds[0]],
    );
    expect(before.rows[0].due_date).toBe('2026-11-05');

    const stored = await db.query<{ reschedule_draft: RescheduleDraft }>(
      `SELECT reschedule_draft FROM goals WHERE id = $1`,
      [goalId],
    );
    expect(stored.rows[0].reschedule_draft).toBeTruthy();

    const confirm = await request(app)
      .post('/api/quests/reschedule/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ draft: sample, local_date: today })
      .expect(201);

    expect(confirm.body.quests).toHaveLength(2);
    expect(confirm.body.quests.map((q: { due_date: string }) => q.due_date).sort()).toEqual([
      '2026-11-09',
      '2026-11-10',
    ]);

    const after = await db.query<{ id: number; due_date: string }>(
      `SELECT id, due_date FROM quests WHERE id = ANY($1::int[]) ORDER BY id`,
      [overdueIds],
    );
    expect(after.rows.map((r) => r.due_date)).toEqual(['2026-11-09', '2026-11-10']);

    // No duplicate quest rows created.
    const count = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM quests WHERE milestone_id = (
         SELECT id FROM milestones WHERE goal_id = $1 LIMIT 1
       )`,
      [goalId],
    );
    expect(Number(count.rows[0].n)).toBe(3);

    const cleared = await db.query<{ reschedule_draft: unknown }>(
      `SELECT reschedule_draft FROM goals WHERE id = $1`,
      [goalId],
    );
    expect(cleared.rows[0].reschedule_draft).toBeNull();

    const todayAfter = await request(app)
      .get(`/api/quests/today?local_date=${today}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(todayAfter.body.overdue_quests).toHaveLength(0);
  });

  it('does not invent a draft when nothing is overdue', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'no-overdue@questline.test');
    const user = await db.query<{ id: number }>(
      `SELECT id FROM users WHERE email = $1`,
      ['no-overdue@questline.test'],
    );
    const goal = await db.query<{ id: number }>(
      `INSERT INTO goals (
         user_id, title, done_definition, starting_point,
         time_budget_minutes_per_day, deadline, status, created_at
       ) VALUES ($1, 'Goal', 'Done', 'Start', 20, '2027-01-01', 'active', $2)
       RETURNING id`,
      [user.rows[0].id, iso],
    );
    await db.query(
      `INSERT INTO milestones (goal_id, position, title, description, target_date, status)
       VALUES ($1, 1, 'Stage', null, '2026-11-16', 'current')`,
      [goal.rows[0].id],
    );

    const res = await request(app)
      .post('/api/quests/reschedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ local_date: today })
      .expect(200);

    expect(res.body.draft).toBeNull();
    expect(res.body.overdue).toEqual([]);
    expect(proposeReschedule).not.toHaveBeenCalled();
  });

  // AC: Mochi proposes new dates; revise keeps confirm-before-save
  it('revises a draft without writing due dates until confirm', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'revise-reschedule@questline.test');
    const { overdueIds } = await seedGoalWithOverdue('revise-reschedule@questline.test');
    const first = draftFor(overdueIds);
    const second: RescheduleDraft = {
      ...first,
      moves: [
        { ...first.moves[0], to_date: '2026-11-11' },
        { ...first.moves[1], to_date: '2026-11-12' },
      ],
      mochi_message: "Let's adjust the plan together — a little more room.",
    };
    proposeReschedule.mockResolvedValue(first);
    reviseReschedule.mockResolvedValue(second);

    await request(app)
      .post('/api/quests/reschedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ local_date: today })
      .expect(201);

    const revised = await request(app)
      .post('/api/quests/reschedule/revise')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedback: 'push later', local_date: today })
      .expect(200);

    expect(revised.body.draft.moves[0].to_date).toBe('2026-11-11');
    expect(reviseReschedule).toHaveBeenCalledTimes(1);

    const stillOld = await db.query<{ due_date: string }>(
      `SELECT due_date FROM quests WHERE id = $1`,
      [overdueIds[0]],
    );
    expect(stillOld.rows[0].due_date).toBe('2026-11-05');
  });
});
