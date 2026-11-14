import { DiaryNoteSchema, MAX_DIARY_NOTE_LENGTH } from '@questline/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createEchoChatClient } from '../ai/client.js';
import { createApp } from '../app.js';
import type { Clock } from '../clock.js';
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

describe('GET /api/diary-notes & PUT /api/diary-notes (Issue #19)', () => {
  let db: Db;
  const clock = fixedClock('2026-11-10T15:00:00.000Z');

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

  function buildApp(customClock: Clock = clock) {
    return createApp({
      db,
      clock: customClock,
      ai: createEchoChatClient(),
    });
  }

  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    const app = buildApp();
    await request(app).get('/api/diary-notes').expect(401);
    await request(app).put('/api/diary-notes').send({ content: 'Hello' }).expect(401);
  });

  it('saves a diary note, reloads it on the same day, and updates in place when saved twice (one note per goal per day)', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    // 1. Initial GET returns empty content for today
    const initialRes = await request(app)
      .get('/api/diary-notes?local_date=2026-11-10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(DiaryNoteSchema.safeParse(initialRes.body).success).toBe(true);
    expect(initialRes.body).toEqual({
      id: null,
      goal_id: 1,
      note_date: '2026-11-10',
      content: '',
      updated_at: null,
    });

    // 2. First save creates the note
    const firstSave = await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Read 2 pages over morning tea. Kana felt much easier today!',
        local_date: '2026-11-10',
      })
      .expect(200);

    expect(DiaryNoteSchema.safeParse(firstSave.body).success).toBe(true);
    expect(firstSave.body.id).toEqual(expect.any(Number));
    expect(firstSave.body.goal_id).toBe(1);
    expect(firstSave.body.note_date).toBe('2026-11-10');
    expect(firstSave.body.content).toBe(
      'Read 2 pages over morning tea. Kana felt much easier today!',
    );
    expect(firstSave.body.updated_at).toBe('2026-11-10T15:00:00Z');

    // 3. Second save on the same day updates the existing note rather than duplicating
    const laterApp = buildApp(fixedClock('2026-11-10T16:30:00.000Z'));
    const secondSave = await request(laterApp)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Updated note: also jotted down 3 new words before bed ♡',
        local_date: '2026-11-10',
      })
      .expect(200);

    expect(secondSave.body.id).toBe(firstSave.body.id);
    expect(secondSave.body.content).toBe(
      'Updated note: also jotted down 3 new words before bed ♡',
    );
    expect(secondSave.body.updated_at).toBe('2026-11-10T16:30:00Z');

    const countRes = await db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM diary_notes WHERE goal_id = 1 AND note_date = '2026-11-10'`,
    );
    expect(countRes.rows[0].count).toBe(1);

    // 4. Reloading on the same day returns the saved note
    const reloadRes = await request(laterApp)
      .get('/api/diary-notes?local_date=2026-11-10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(reloadRes.body).toEqual(secondSave.body);
  });

  it('rejects invalid calendar dates and dates more than 1 day away from the server date, while allowing ±1 day', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    // Non-existent calendar date (2026-02-30)
    const fakeDateGet = await request(app)
      .get('/api/diary-notes?local_date=2026-02-30')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(fakeDateGet.body.error.code).toBe('VALIDATION_ERROR');

    const fakeDatePut = await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Note', local_date: '2026-02-30' })
      .expect(400);
    expect(fakeDatePut.body.error.code).toBe('VALIDATION_ERROR');

    // Arbitrary past/future dates outside ±1 day of 2026-11-10
    const pastPut = await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Backdated note', local_date: '2026-11-05' })
      .expect(400);
    expect(pastPut.body.error.code).toBe('VALIDATION_ERROR');

    const futureGet = await request(app)
      .get('/api/diary-notes?local_date=2026-11-15')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(futureGet.body.error.code).toBe('VALIDATION_ERROR');

    // Valid timezone edge cases: ±1 day of 2026-11-10
    await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'UTC-12 reflection', local_date: '2026-11-09' })
      .expect(200);

    await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'UTC+14 reflection', local_date: '2026-11-11' })
      .expect(200);
  });

  it('rejects content longer than 2,000 characters with 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const tooLong = 'x'.repeat(MAX_DIARY_NOTE_LENGTH + 1);
    const res = await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: tooLong, local_date: '2026-11-10' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('never exposes another user’s diary note and scopes notes to the logged-in user’s active goal', async () => {
    const app = buildApp();
    const demoToken = await loginAsDemo(app);

    await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${demoToken}`)
      .send({ content: 'Demo user private reflection ♡', local_date: '2026-11-10' })
      .expect(200);

    // Register a second user (no active goal yet)
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@questline.local', password: 'other-password-123' })
      .expect(201);
    const otherToken = regRes.body.token as string;

    // Second user sees empty note with goal_id: null, never demo user's note
    const otherGet = await request(app)
      .get('/api/diary-notes?local_date=2026-11-10')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);

    expect(otherGet.body).toEqual({
      id: null,
      goal_id: null,
      note_date: '2026-11-10',
      content: '',
      updated_at: null,
    });

    // Second user cannot save without an active goal
    await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ content: 'Should fail without active goal', local_date: '2026-11-10' })
      .expect(404);

    // Give second user their own active goal via manual-plan and save their own note
    await request(app)
      .post('/api/goals/manual-plan')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        title: 'Practice guitar',
        concrete_goal: 'Play one song cleanly',
        deadline: '2027-03-01',
        milestones: ['Learn basic chords'],
      })
      .expect(201);

    await request(app)
      .put('/api/diary-notes')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ content: 'Practiced C and G chords', local_date: '2026-11-10' })
      .expect(200);

    // Demo user's note is untouched
    const demoGet = await request(app)
      .get('/api/diary-notes?local_date=2026-11-10')
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(200);
    expect(demoGet.body.content).toBe('Demo user private reflection ♡');
  });
});
