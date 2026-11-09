import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestPlanDraft } from '@questline/shared';
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

const sampleDraft: QuestPlanDraft = {
  quests: [
    { title: 'Read 2 pages of your graded reader', due_date: '2026-11-09', estimated_minutes: 10 },
    { title: 'Write down 3 new words', due_date: '2026-11-09', estimated_minutes: 10 },
    { title: 'Read 2 more pages tomorrow', due_date: '2026-11-10', estimated_minutes: 15 },
  ],
  mochi_message: 'Tiny quests for your reading habit ♡',
};

describe('GET/POST /api/quests draft+confirm (Issue #7)', () => {
  let db: Db;
  const iso = '2026-11-09T15:00:00.000Z';
  const clock = fixedClock(iso);
  let proposeQuestPlan: ReturnType<typeof vi.fn>;
  let reviseQuestPlan: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, clock);
    proposeQuestPlan = vi.fn(async () => sampleDraft);
    reviseQuestPlan = vi.fn(async () => ({
      ...sampleDraft,
      quests: [
        ...sampleDraft.quests,
        {
          title: 'Say one sentence out loud',
          due_date: '2026-11-11',
          estimated_minutes: 5,
        },
      ],
      mochi_message: 'Tweaked your quests with your note ♡',
    }));
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp() {
    return createApp({
      db,
      clock,
      ai: stubAi({ proposeQuestPlan, reviseQuestPlan }),
    });
  }

  async function insertGoalWithCurrentMilestone(email: string): Promise<{
    goalId: number;
    milestoneId: number;
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
    return { goalId: goal.rows[0].id, milestoneId: milestone.rows[0].id };
  }

  it('rejects missing Bearer token with UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/quests/draft').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects propose when the user has no current milestone', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'no-milestone@questline.test');
    const res = await request(app)
      .post('/api/quests/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(proposeQuestPlan).not.toHaveBeenCalled();
  });

  // AC: Quests generated for current milestone only; draft until confirm; title/due/duration
  it('proposes a draft for the current milestone without writing quests', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'quest-draft@questline.test');
    const { milestoneId } = await insertGoalWithCurrentMilestone('quest-draft@questline.test');

    const res = await request(app)
      .post('/api/quests/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.milestone.id).toBe(milestoneId);
    expect(res.body.draft.quests).toHaveLength(3);
    expect(res.body.draft.quests[0].title).toBeTruthy();
    expect(res.body.draft.quests[0].due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.draft.quests[0].estimated_minutes).toBeGreaterThan(0);
    expect(res.body.confirmed).toBe(false);
    expect(proposeQuestPlan).toHaveBeenCalledTimes(1);

    const count = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM quests WHERE milestone_id = $1`,
      [milestoneId],
    );
    expect(count.rows[0].n).toBe(0);

    const draftCol = await db.query<{ quest_draft: unknown }>(
      `SELECT quest_draft FROM milestones WHERE id = $1`,
      [milestoneId],
    );
    expect(draftCol.rows[0].quest_draft).toMatchObject({
      mochi_message: sampleDraft.mochi_message,
    });
  });

  // AC: Quests are saved and not regenerated on every page load
  it('returns seeded quests without regenerating on propose', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const first = await request(app)
      .post('/api/quests/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(first.body.confirmed).toBe(true);
    expect(first.body.draft).toBeNull();
    expect(first.body.quests.length).toBeGreaterThan(0);
    expect(proposeQuestPlan).not.toHaveBeenCalled();

    const second = await request(app)
      .get('/api/quests/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(second.body.confirmed).toBe(true);
    expect(second.body.quests.length).toBe(first.body.quests.length);
    expect(proposeQuestPlan).not.toHaveBeenCalled();
  });

  it('confirms a draft and surfaces quests on /today', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'quest-confirm@questline.test');
    const { milestoneId } = await insertGoalWithCurrentMilestone('quest-confirm@questline.test');

    await request(app)
      .post('/api/quests/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const confirm = await request(app)
      .post('/api/quests/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ draft: sampleDraft })
      .expect(201);

    expect(confirm.body.quests).toHaveLength(3);
    expect(confirm.body.milestone.id).toBe(milestoneId);

    const count = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM quests WHERE milestone_id = $1`,
      [milestoneId],
    );
    expect(count.rows[0].n).toBe(3);

    const draftCol = await db.query<{ quest_draft: unknown }>(
      `SELECT quest_draft FROM milestones WHERE id = $1`,
      [milestoneId],
    );
    expect(draftCol.rows[0].quest_draft).toBeNull();

    const today = await request(app)
      .get('/api/quests/today')
      .query({ local_date: '2026-11-09' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(today.body.total_count).toBe(2);
    expect(today.body.quests.map((q: { title: string }) => q.title)).toEqual(
      expect.arrayContaining([
        'Read 2 pages of your graded reader',
        'Write down 3 new words',
      ]),
    );
  });

  // AC: each day's quests fit within the user's daily time budget
  it('rejects confirm when a day exceeds the time budget', async () => {
    const app = buildApp();
    const token = await registerFresh(app, 'quest-budget@questline.test');
    await insertGoalWithCurrentMilestone('quest-budget@questline.test');

    const res = await request(app)
      .post('/api/quests/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draft: {
          quests: [
            { title: 'A', due_date: '2026-11-09', estimated_minutes: 15 },
            { title: 'B', due_date: '2026-11-09', estimated_minutes: 15 },
          ],
          mochi_message: 'Too packed',
        },
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
