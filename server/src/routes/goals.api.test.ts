import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_TITLES, seedDemoDataIfEmpty } from '../db/seed.js';
import { systemClock } from '../clock.js';

async function loginAsDemo(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    .expect(200);
  return res.body.token as string;
}

describe('GET/PATCH/POST/DELETE /api/goals (Issue #18)', () => {
  let db: Db;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, systemClock);
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp() {
    return createApp({ db, clock: systemClock });
  }

  it('rejects missing Bearer token with UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/goals').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // AC: list goals; active remembered (DB)
  it('GET /api/goals lists goals with the active id', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const res = await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.goals).toHaveLength(2);
    expect(res.body.active_goal_id).toEqual(expect.any(Number));
    const active = res.body.goals.find(
      (g: { id: number }) => g.id === res.body.active_goal_id,
    );
    expect(active.title).toBe(DEMO_TITLES.goal);
    expect(active.status).toBe('active');
  });

  // AC: selector switches active; Today/Map use active goal
  it('PATCH /api/goals/:id/activate switches the active goal', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const listed = await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const paused = listed.body.goals.find(
      (g: { status: string }) => g.status === 'paused',
    );

    const res = await request(app)
      .patch(`/api/goals/${paused.id}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.active_goal_id).toBe(paused.id);
    expect(res.body.goal.status).toBe('active');

    const today = await request(app)
      .get('/api/quests/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    // Paused 5K goal has no quests / milestones in seed — Today reflects that goal.
    expect(today.body.goal_title).toBe(DEMO_TITLES.pausedGoal);
  });

  // AC: start a new goal without deleting others
  it('POST /api/goals/new pauses active and restarts the interview', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const before = await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const previousActive = before.body.active_goal_id as number;

    const res = await request(app)
      .post('/api/goals/new')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.paused_goal_id).toBe(previousActive);
    expect(res.body.active_goal_id).toBeNull();
    expect(
      res.body.goals.some(
        (g: { id: number; status: string }) =>
          g.id === previousActive && g.status === 'paused',
      ),
    ).toBe(true);

    const chat = await request(app)
      .get('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(chat.body.interview.status).toBe('in_progress');
    expect(chat.body.interview.current_topic).toBe('done_definition');
  });

  // AC: delete after confirm removes milestones + quests
  it('DELETE /api/goals/:id removes the goal tree and promotes another', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const listed = await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const active = listed.body.goals.find(
      (g: { status: string }) => g.status === 'active',
    );
    const paused = listed.body.goals.find(
      (g: { status: string }) => g.status === 'paused',
    );

    const res = await request(app)
      .delete(`/api/goals/${active.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.deleted_goal_id).toBe(active.id);
    expect(res.body.active_goal_id).toBe(paused.id);
    expect(res.body.goals).toHaveLength(1);

    const milestones = await db.query(`SELECT id FROM milestones WHERE goal_id = $1`, [
      active.id,
    ]);
    expect(milestones.rowCount).toBe(0);
  });
});
