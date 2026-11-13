import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, resetDatabase, type Db } from './connection.js';
import { seedDemoDataIfEmpty } from './seed.js';
import { systemClock } from '../clock.js';

const REQUIRED_TABLES = [
  'users',
  'goals',
  'milestones',
  'quests',
  'user_progress',
  'stamps',
  'chat_messages',
] as const;

describe('Postgres persistence (Issue #17)', () => {
  let db: Db;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await db?.end();
  });

  // AC: SQL migrations applied; schema covers core tables
  it('applies migrations that create the core tables', async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const names = rows.map((r) => r.table_name);
    for (const table of REQUIRED_TABLES) {
      expect(names).toContain(table);
    }
  });

  // AC: Relationships User → Goals → Milestones → Quests; one active goal per user
  it('enforces Goal → Milestone → Quest FKs and one active goal per user', async () => {
    const user = await db.query<{ id: number }>(
      `INSERT INTO users (email, password_hash)
       VALUES ('ac-test@questline.local', 'dev-placeholder')
       RETURNING id`,
    );
    const userId = user.rows[0].id;

    const goal = await db.query<{ id: number }>(
      `INSERT INTO goals (user_id, title, status, created_at)
       VALUES ($1, 'Learn Japanese', 'active', NOW())
       RETURNING id`,
      [userId],
    );
    const goalId = goal.rows[0].id;

    const milestone = await db.query<{ id: number }>(
      `INSERT INTO milestones (goal_id, position, title, status)
       VALUES ($1, 1, 'Hiragana', 'current')
       RETURNING id`,
      [goalId],
    );

    await db.query(
      `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes)
       VALUES ($1, 'Practice あいう', '2026-11-09', 10)`,
      [milestone.rows[0].id],
    );

    await expect(
      db.query(
        `INSERT INTO goals (user_id, title, status, created_at)
         VALUES ($1, 'Second active', 'active', NOW())`,
        [userId],
      ),
    ).rejects.toThrow();
  });

  // AC: Seed data for local/dev
  it('seeds a demo user with an active Goal → Milestone → today Quests', async () => {
    await seedDemoDataIfEmpty(db, systemClock);

    const users = await db.query(`SELECT id FROM users`);
    expect(users.rowCount).toBe(1);

    const goals = await db.query<{ status: string }>(
      `SELECT status FROM goals ORDER BY status ASC`,
    );
    // Active novel goal + paused 5K goal for the multi-goal selector (#18).
    expect(goals.rowCount).toBe(2);
    expect(goals.rows.map((g) => g.status).sort()).toEqual(['active', 'paused']);

    const quests = await db.query(`SELECT id FROM quests`);
    expect(quests.rowCount).toBeGreaterThanOrEqual(1);

    // Idempotent — second seed does not duplicate
    await seedDemoDataIfEmpty(db, systemClock);
    const usersAgain = await db.query(`SELECT id FROM users`);
    expect(usersAgain.rowCount).toBe(1);
  });

  // AC: require DATABASE_URL (no SQLite default path)
  it('rejects opening a database without DATABASE_URL', async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(openDatabase()).rejects.toThrow(/DATABASE_URL/);
    } finally {
      process.env.DATABASE_URL = previous;
    }
  });
});
