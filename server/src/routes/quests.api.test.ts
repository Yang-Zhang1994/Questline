import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { Clock } from '../clock.js';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/connection.js';
import { seedDemoDataIfEmpty } from '../db/seed.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

describe('GET/PATCH /api/quests (Issue #9)', () => {
  let db: Db;

  afterEach(() => {
    db?.close();
  });

  function buildApp(iso = '2026-10-28T15:30:00.000Z') {
    const clock = fixedClock(iso);
    db = openDatabase({ filename: ':memory:' });
    seedDemoDataIfEmpty(db, clock);
    return createApp({ db, clock });
  }

  // AC: User can mark a quest as done from the daily note
  it('PATCH /api/quests/:id/completion marks a quest done', async () => {
    const app = buildApp();
    const today = await request(app).get('/api/quests/today').expect(200);
    const questId = today.body.quests[0].id as number;

    const res = await request(app)
      .patch(`/api/quests/${questId}/completion`)
      .send({ completed: true })
      .expect(200);

    expect(res.body.quest.completed_at).toBe('2026-10-28T15:30:00Z');
  });

  // AC: User can undo an accidental check-off
  it('PATCH completion false undoes a check-off', async () => {
    const app = buildApp();
    const today = await request(app).get('/api/quests/today').expect(200);
    const questId = today.body.quests[0].id as number;

    await request(app)
      .patch(`/api/quests/${questId}/completion`)
      .send({ completed: true })
      .expect(200);

    const undone = await request(app)
      .patch(`/api/quests/${questId}/completion`)
      .send({ completed: false })
      .expect(200);

    expect(undone.body.quest.completed_at).toBeNull();
  });

  // AC: Completion status and completion time are saved
  // AC: Completed quests stay completed after a page reload
  it('GET /api/quests/today returns saved completion after reload', async () => {
    const app = buildApp();
    const today = await request(app).get('/api/quests/today').expect(200);
    expect(today.body.total_count).toBe(3);
    const questId = today.body.quests[0].id as number;

    await request(app)
      .patch(`/api/quests/${questId}/completion`)
      .send({ completed: true })
      .expect(200);

    const reloaded = await request(app).get('/api/quests/today').expect(200);
    const quest = reloaded.body.quests.find((q: { id: number }) => q.id === questId);
    expect(quest.completed_at).toBe('2026-10-28T15:30:00Z');
    expect(reloaded.body.done_count).toBe(1);
  });

  it('rejects invalid completion body', async () => {
    const app = buildApp();
    const today = await request(app).get('/api/quests/today').expect(200);
    const questId = today.body.quests[0].id as number;

    await request(app)
      .patch(`/api/quests/${questId}/completion`)
      .send({ completed: 'yes' })
      .expect(400);
  });
});
