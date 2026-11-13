import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { systemClock } from '../clock.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoDataIfEmpty } from '../db/seed.js';

async function loginAsDemo(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    .expect(200);
  return res.body.token as string;
}

describe('POST /api/goals/manual-plan (Issue #21)', () => {
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

  it('creates the goal and milestones visible on Map', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const res = await request(app)
      .post('/api/goals/manual-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Walk more gently',
        concrete_goal: 'Take a 20-minute walk four days a week',
        deadline: '2027-06-01',
        milestones: ['Find comfy shoes', 'Walk around the block', 'Build a soft streak'],
      })
      .expect(201);

    expect(res.body.goal.title).toBe('Walk more gently');
    expect(res.body.goal.status).toBe('active');
    expect(res.body.milestones).toHaveLength(3);
    expect(res.body.milestones[0].title).toBe('Find comfy shoes');
    expect(res.body.milestones[0].status).toBe('current');

    const map = await request(app)
      .get('/api/roadmap')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(map.body.goal.title).toBe('Walk more gently');
    expect(map.body.milestones).toHaveLength(3);

    const plan = await request(app)
      .get('/api/milestones')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(plan.body.milestones).toHaveLength(3);
  });

  it('rejects missing name or milestones', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const missingName = await request(app)
      .post('/api/goals/manual-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '', milestones: ['Stage one'] })
      .expect(400);
    expect(missingName.body.error.code).toBe('VALIDATION_ERROR');

    const missingMilestones = await request(app)
      .post('/api/goals/manual-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'A goal', milestones: [] })
      .expect(400);
    expect(missingMilestones.body.error.code).toBe('VALIDATION_ERROR');
  });
});
