import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createEchoChatClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import { createApp } from '../app.js';
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

describe('POST /api/milestones/:id/complete (Issue #10)', () => {
  let db: Db;
  const iso = '2026-11-10T15:00:00.000Z';
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
    return createApp({ db, clock, ai: createEchoChatClient() });
  }

  async function currentMilestoneId(token: string, app: ReturnType<typeof createApp>) {
    const res = await request(app)
      .get('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body.milestone.id as number;
  }

  async function completeAllCurrentQuests(token: string, app: ReturnType<typeof createApp>) {
    const res = await request(app)
      .get('/api/quests')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    for (const quest of res.body.quests as Array<{ id: number; completed_at: string | null }>) {
      if (quest.completed_at == null) {
        await request(app)
          .patch(`/api/quests/${quest.id}/completion`)
          .set('Authorization', `Bearer ${token}`)
          .send({ completed: true, local_date: '2026-11-10' })
          .expect(200);
      }
    }
  }

  it('sets stage_ready on GET /api/quests after all current-stage quests are done', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    await completeAllCurrentQuests(token, app);

    const quests = await request(app)
      .get('/api/quests?local_date=2026-11-10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(quests.body.stage_ready).toBe(true);
    expect(quests.body.stage_ready_milestone?.milestone_title).toMatch(/daily reading habit/i);
  });

  it('advances mid-roadmap and celebrates the final stage', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const currentId = await currentMilestoneId(token, app);

    // Add a second stage so the first clear is mid-roadmap.
    const goalId = (
      await request(app).get('/api/quests').set('Authorization', `Bearer ${token}`).expect(200)
    ).body.goal.id as number;
    await db.query(
      `INSERT INTO milestones (goal_id, position, title, description, target_date, status)
       VALUES ($1, 2, 'Finish a graded reader', 'Next stage', '2027-03-01', 'upcoming')`,
      [goalId],
    );

    await completeAllCurrentQuests(token, app);
    const mid = await request(app)
      .post(`/api/milestones/${currentId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(mid.body.goal_completed).toBe(false);
    expect(mid.body.completed_milestone.status).toBe('completed');
    expect(mid.body.next_milestone.status).toBe('current');

    // Complete the final stage's (empty) quests by seeding + finishing them.
    const nextId = mid.body.next_milestone.id as number;
    await db.query(
      `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at)
       VALUES ($1, 'Final tiny quest', '2026-11-10', 10, $2)`,
      [nextId, iso],
    );

    const final = await request(app)
      .post(`/api/milestones/${nextId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(final.body.goal_completed).toBe(true);
    expect(final.body.mochi_message).toMatch(/You did it/i);
  });

  it('requires JWT', async () => {
    const app = buildApp();
    await request(app).post('/api/milestones/1/complete').expect(401);
  });
});
