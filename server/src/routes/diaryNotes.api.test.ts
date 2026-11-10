import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoDataIfEmpty } from '../db/seed.js';
import { systemClock } from '../clock.js';

async function loginAsDemo(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    .expect(200);
  return res.body.token as string;
}

describe('GET/PUT /api/diary-notes (Issue #19)', () => {
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
    const res = await request(app).get('/api/diary-notes').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // AC: one note per goal per day; reopen same day shows saved note
  it('returns empty content before any save, then persists after PUT', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const localDate = '2026-11-09';

    const empty = await request(app)
      .get(`/api/diary-notes?local_date=${localDate}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(empty.body.content).toBe('');
    expect(empty.body.note_date).toBe(localDate);
    expect(empty.body.goal_id).toEqual(expect.any(Number));
    expect(empty.body.id).toBeNull();

    const saved = await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Felt calm reading today ♡', local_date: localDate })
      .expect(200);

    expect(saved.body.content).toBe('Felt calm reading today ♡');
    expect(saved.body.note_date).toBe(localDate);
    expect(saved.body.id).toEqual(expect.any(Number));
    expect(saved.body.updated_at).toEqual(expect.any(String));

    const reloaded = await request(app)
      .get(`/api/diary-notes?local_date=${localDate}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(reloaded.body.content).toBe('Felt calm reading today ♡');
    expect(reloaded.body.id).toBe(saved.body.id);
  });

  // AC: one note per goal per day
  it('keeps separate notes per active goal on the same local date', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const localDate = '2026-11-09';

    await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Novel note', local_date: localDate })
      .expect(200);

    const goals = await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const paused = goals.body.goals.find((g: { status: string }) => g.status === 'paused');

    await request(app)
      .patch(`/api/goals/${paused.id}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const otherEmpty = await request(app)
      .get(`/api/diary-notes?local_date=${localDate}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(otherEmpty.body.content).toBe('');
    expect(otherEmpty.body.goal_id).toBe(paused.id);

    await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '5K note', local_date: localDate })
      .expect(200);

    const otherReloaded = await request(app)
      .get(`/api/diary-notes?local_date=${localDate}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(otherReloaded.body.content).toBe('5K note');

    const novel = goals.body.goals.find((g: { status: string }) => g.status === 'active');
    await request(app)
      .patch(`/api/goals/${novel.id}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const novelReloaded = await request(app)
      .get(`/api/diary-notes?local_date=${localDate}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(novelReloaded.body.content).toBe('Novel note');
  });

  it('upserts the same day without creating a second row', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const localDate = '2026-11-10';

    const first = await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'first', local_date: localDate })
      .expect(200);

    const second = await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'second draft', local_date: localDate })
      .expect(200);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.content).toBe('second draft');
  });

  it('rejects invalid local_date', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);
    const res = await request(app)
      .get('/api/diary-notes?local_date=11-09-2026')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
