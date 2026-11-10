import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/connection.js';
import { seedDemoDataIfEmpty } from '../db/seed.js';

describe('GET /api/roadmap (Issue #6)', () => {
  let db: Db;

  afterEach(() => {
    db?.close();
  });

  it('returns the active goal and milestones for the roadmap', async () => {
    db = openDatabase({ filename: ':memory:' });
    seedDemoDataIfEmpty(db);
    const app = createApp({ db });

    const res = await request(app).get('/api/roadmap').expect(200);

    expect(res.body.goal).not.toBeNull();
    expect(res.body.goal.title).toBe('Read a Japanese novel on my own');
    expect(res.body.goal.status).toBe('active');
    expect(res.body.milestones).toHaveLength(5);

    expect(res.body.milestones[0].title).toBe('Learn Hiragana & Katakana');
    expect(res.body.milestones[0].status).toBe('completed');
    expect(res.body.milestones[1].title).toBe('Build a tiny daily reading habit');
    expect(res.body.milestones[1].status).toBe('current');
  });

  it('returns empty roadmap payload when no goals exist', async () => {
    db = openDatabase({ filename: ':memory:' });
    const app = createApp({ db });

    const res = await request(app).get('/api/roadmap').expect(200);
    expect(res.body.goal).toBeNull();
    expect(res.body.milestones).toEqual([]);
  });
});
