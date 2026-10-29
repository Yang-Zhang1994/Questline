import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createQuestStore } from './store.js';

async function testApp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'questline-api-'));
  const store = createQuestStore(path.join(dir, 'quests.json'));
  return createApp(store);
}

describe('quests API', () => {
  it('lists today quests', async () => {
    const app = await testApp();
    const res = await request(app).get('/api/quests/today');
    expect(res.status).toBe(200);
    expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(res.body.quests)).toBe(true);
    expect(res.body.quests.length).toBeGreaterThan(0);
  });

  it('completes and uncompletes a quest', async () => {
    const app = await testApp();
    const list = await request(app).get('/api/quests/today');
    const id = list.body.quests[0].id as string;

    const done = await request(app).post(`/api/quests/${id}/complete`);
    expect(done.status).toBe(200);
    expect(done.body.quest.completed).toBe(true);
    expect(done.body.quest.completedAt).toBeTruthy();

    const undone = await request(app).post(`/api/quests/${id}/uncomplete`);
    expect(undone.status).toBe(200);
    expect(undone.body.quest.completed).toBe(false);
    expect(undone.body.quest.completedAt).toBeNull();
  });

  it('returns 404 for unknown quest', async () => {
    const app = await testApp();
    const res = await request(app).post('/api/quests/missing-id/complete');
    expect(res.status).toBe(404);
  });
});
