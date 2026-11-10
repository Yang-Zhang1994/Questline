import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

describe('POST /api/milestones/:id/complete (Issue #10)', () => {
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
    return createApp({ db, clock, ai: stubAi() });
  }

  async function currentMilestoneId(token: string, app: ReturnType<typeof createApp>) {
    const today = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const quest = today.body.quests[0];
    return quest.milestone_id as number;
  }

  async function completeAllToday(token: string, app: ReturnType<typeof createApp>) {
    const today = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    for (const quest of today.body.quests as Array<{ id: number; completed_at: string | null }>) {
      if (quest.completed_at == null) {
        await request(app)
          .patch(`/api/quests/${quest.id}/completion`)
          .set('Authorization', `Bearer ${token}`)
          .send({ completed: true, local_date: '2026-10-28' })
          .expect(200);
      }
    }
  }

  it('prompts readiness on today after all current-stage quests are done', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    await completeAllToday(token, app);

    const today = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(today.body.stage_ready).toBe(true);
    expect(today.body.stage_ready_milestone?.milestone_title).toMatch(/daily reading habit/i);
  });

  it('advances highlight to the next milestone and marks completed stages', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const user = await db.query<{ id: number }>(
      `SELECT id FROM users WHERE email = $1`,
      [DEMO_EMAIL],
    );
    const goal = await db.query<{ id: number }>(
      `SELECT id FROM goals WHERE user_id = $1 AND status = 'active'`,
      [user.rows[0].id],
    );
    await db.query(
      `INSERT INTO milestones (goal_id, position, title, description, target_date, status)
       VALUES ($1, 2, 'Finish a graded reader', 'Level up softly', '2027-03-01', 'upcoming')`,
      [goal.rows[0].id],
    );

    await completeAllToday(token, app);
    const milestoneId = await currentMilestoneId(token, app);

    const res = await request(app)
      .post(`/api/milestones/${milestoneId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.goal_completed).toBe(false);
    expect(res.body.completed_milestone.status).toBe('completed');
    expect(res.body.next_milestone.status).toBe('current');
    expect(res.body.next_milestone.title).toBe('Finish a graded reader');
    expect(res.body.milestones.map((m: { status: string }) => m.status)).toEqual([
      'completed',
      'current',
    ]);
    expect(res.body.mochi_message).toMatch(/Stage cleared/i);

    const plan = await request(app)
      .get('/api/milestones/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(plan.body.milestones[0].status).toBe('completed');
    expect(plan.body.milestones[1].status).toBe('current');
  });

  it('returns goal-complete celebration when the final stage clears', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    await completeAllToday(token, app);
    const milestoneId = await currentMilestoneId(token, app);

    const res = await request(app)
      .post(`/api/milestones/${milestoneId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.goal_completed).toBe(true);
    expect(res.body.next_milestone).toBeNull();
    expect(res.body.mochi_message).toMatch(/You did it/i);

    const plan = await request(app)
      .get('/api/milestones/draft')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(plan.body.confirmed).toBe(true);
    expect(plan.body.milestones.every((m: { status: string }) => m.status === 'completed')).toBe(
      true,
    );
  });

  it('requires JWT', async () => {
    const app = buildApp();
    await request(app).post('/api/milestones/1/complete').expect(401);
  });
});
