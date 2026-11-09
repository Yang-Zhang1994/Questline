import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MilestonePlanDraft } from '@questline/shared';
import type { Clock } from '../clock.js';
import { createApp } from '../app.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoDataIfEmpty } from '../db/seed.js';
import { stubAi } from '../test/aiStub.js';

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

const sampleDraft: MilestonePlanDraft = {
  milestones: [
    {
      position: 1,
      title: 'Tiny habit',
      description: 'Read a little each day',
      target_date: '2026-12-01',
    },
    {
      position: 2,
      title: 'Comfort basics',
      description: 'Build vocabulary gently',
      target_date: '2027-03-01',
    },
    {
      position: 3,
      title: 'Stretch practice',
      description: 'Try short stories',
      target_date: '2027-07-01',
    },
    {
      position: 4,
      title: 'Finish the novel',
      description: 'Complete the goal',
      target_date: '2027-11-01',
    },
  ],
  mochi_message: 'Here is a cozy 4-stage map ♡',
};

describe('GET/POST /api/milestones (Issue #5)', () => {
  let db: Db;
  const iso = '2026-11-09T15:00:00.000Z';
  const clock = fixedClock(iso);
  let proposeMilestonePlan: ReturnType<typeof vi.fn>;
  let reviseMilestonePlan: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, clock);
    proposeMilestonePlan = vi.fn(async () => sampleDraft);
    reviseMilestonePlan = vi.fn(async () => ({
      ...sampleDraft,
      milestones: [
        ...sampleDraft.milestones.slice(0, 3),
        {
          position: 4,
          title: 'Renamed finale',
          description: 'Reworked last stage',
          target_date: '2027-10-15',
        },
        {
          position: 5,
          title: 'Celebration',
          description: 'Notice how far you came',
          target_date: '2027-11-05',
        },
      ],
      mochi_message: 'Tweaked the map with your note ♡',
    }));
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp() {
    return createApp({
      db,
      clock,
      ai: stubAi({ proposeMilestonePlan, reviseMilestonePlan }),
    });
  }

  async function insertActiveGoalWithoutMilestones(email: string): Promise<number> {
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
    return goal.rows[0].id;
  }

  it('rejects missing Bearer token with UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/milestones/draft').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects propose when the user has no active goal', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'no-goal@questline.test');
    const res = await request(app)
      .post('/api/milestones/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(proposeMilestonePlan).not.toHaveBeenCalled();
  });

  // AC: propose 3–7 milestones; draft only until confirm
  it('proposes a draft for an active goal without writing milestones', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'plan-draft@questline.test');
    await insertActiveGoalWithoutMilestones('plan-draft@questline.test');

    const res = await request(app)
      .post('/api/milestones/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.draft.milestones).toHaveLength(4);
    expect(res.body.draft.milestones[0].title).toBeTruthy();
    expect(res.body.draft.milestones[0].description).toBeTruthy();
    expect(res.body.draft.milestones[0].target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.confirmed).toBe(false);
    expect(proposeMilestonePlan).toHaveBeenCalledTimes(1);

    const count = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM milestones WHERE goal_id = (
         SELECT id FROM goals WHERE user_id = (
           SELECT id FROM users WHERE email = 'plan-draft@questline.test'
         ) AND status = 'active'
       )`,
    );
    expect(count.rows[0].n).toBe(0);

    const draftCol = await db.query<{ milestone_draft: unknown }>(
      `SELECT milestone_draft FROM goals WHERE user_id = (
         SELECT id FROM users WHERE email = 'plan-draft@questline.test'
       ) AND status = 'active'`,
    );
    expect(draftCol.rows[0].milestone_draft).toMatchObject({
      mochi_message: sampleDraft.mochi_message,
    });
  });

  it('revises a draft without saving milestone rows', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'plan-revise@questline.test');
    await insertActiveGoalWithoutMilestones('plan-revise@questline.test');
    await request(app)
      .post('/api/milestones/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const res = await request(app)
      .post('/api/milestones/draft/revise')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedback: 'Add a celebration stage and rename the finale' })
      .expect(200);

    expect(res.body.draft.milestones).toHaveLength(5);
    expect(res.body.draft.milestones.some((m: { title: string }) => /Renamed|Celebration/i.test(m.title))).toBe(
      true,
    );
    expect(res.body.confirmed).toBe(false);

    const count = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM milestones m
       INNER JOIN goals g ON g.id = m.goal_id
       INNER JOIN users u ON u.id = g.user_id
       WHERE u.email = 'plan-revise@questline.test'`,
    );
    expect(count.rows[0].n).toBe(0);
  });

  // AC: milestones saved only after confirm
  it('writes milestones to Postgres only on confirm', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'plan-confirm@questline.test');
    await insertActiveGoalWithoutMilestones('plan-confirm@questline.test');
    const drafted = await request(app)
      .post('/api/milestones/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const res = await request(app)
      .post('/api/milestones/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ draft: drafted.body.draft })
      .expect(201);

    expect(res.body.milestones).toHaveLength(4);
    expect(res.body.milestones[0].status).toBe('current');
    expect(res.body.milestones[0].target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const rows = await db.query<{ title: string; status: string; position: number }>(
      `SELECT title, status, position FROM milestones
       WHERE goal_id = (
         SELECT id FROM goals WHERE user_id = (
           SELECT id FROM users WHERE email = 'plan-confirm@questline.test'
         ) AND status = 'active'
       )
       ORDER BY position ASC`,
    );
    expect(rows.rows).toHaveLength(4);
    expect(rows.rows[0]).toMatchObject({ position: 1, status: 'current' });

    const draftCol = await db.query<{ milestone_draft: unknown }>(
      `SELECT milestone_draft FROM goals WHERE user_id = (
         SELECT id FROM users WHERE email = 'plan-confirm@questline.test'
       ) AND status = 'active'`,
    );
    expect(draftCol.rows[0].milestone_draft).toBeNull();
  });

  it('reports the seeded demo plan as already confirmed', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const res = await request(app)
      .get('/api/milestones/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.confirmed).toBe(true);
    expect(res.body.draft).toBeNull();
    expect(res.body.milestones.length).toBeGreaterThan(0);
    expect(proposeMilestonePlan).not.toHaveBeenCalled();
  });
});
