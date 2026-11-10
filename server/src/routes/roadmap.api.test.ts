import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoDataIfEmpty } from '../db/seed.js';

async function loginAsDemo(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    .expect(200);
  return res.body.token as string;
}

describe('GET /api/roadmap (Issue #6)', () => {
  let db: Db;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db);
  });

  afterAll(async () => {
    await db?.end();
  });

  it('rejects unauthorized requests', async () => {
    const app = createApp({ db });
    await request(app).get('/api/roadmap').expect(401);
  });

  it('returns the active goal and milestones for the authenticated user', async () => {
    const app = createApp({ db });
    const token = await loginAsDemo(app);

    const res = await request(app)
      .get('/api/roadmap')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.goal).not.toBeNull();
    expect(res.body.goal.title).toBe('Read a Japanese novel on my own');
    expect(res.body.goal.status).toBe('active');
    expect(res.body.milestones).toHaveLength(1);
    expect(res.body.milestones[0].title).toBe('Build a tiny daily reading habit');
    expect(res.body.milestones[0].status).toBe('current');
  });
});
