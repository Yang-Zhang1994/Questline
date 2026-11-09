import type { Clock } from '../clock.js';
import { formatLocalDate, systemClock, toIsoDateTime } from '../clock.js';
import { hashPassword } from '../auth/password.js';
import type { Db } from './connection.js';

/** Demo login for local/dev after JWT (#31). */
export const DEMO_EMAIL = 'demo@questline.local';
export const DEMO_PASSWORD = 'demo-password-123';

const DEMO_GOAL_TITLE = 'Read a Japanese novel on my own';
const DEMO_MILESTONE_TITLE = 'Build a tiny daily reading habit';

/**
 * Seeds one demo user, active goal, current milestone, and today's quests when
 * the DB has no users yet — enough to demo Today / check-off with JWT.
 */
export async function seedDemoDataIfEmpty(db: Db, clock: Clock = systemClock): Promise<void> {
  const count = await db.query<{ c: string }>('SELECT COUNT(*)::text AS c FROM users');
  if (Number(count.rows[0].c) > 0) return;

  const now = clock.now();
  const today = formatLocalDate(now);
  const createdAt = toIsoDateTime(now);
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const user = await client.query<{ id: number }>(
      `INSERT INTO users (email, password_hash, created_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [DEMO_EMAIL, passwordHash, createdAt],
    );
    const userId = user.rows[0].id;

    const goal = await client.query<{ id: number }>(
      `INSERT INTO goals (
         user_id, title, done_definition, starting_point,
         time_budget_minutes_per_day, deadline, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING id`,
      [
        userId,
        DEMO_GOAL_TITLE,
        'Finish one short Japanese novel without looking up every word',
        'Know hiragana and a few basic phrases',
        30,
        '2027-10-28',
        createdAt,
      ],
    );

    const milestone = await client.query<{ id: number }>(
      `INSERT INTO milestones (goal_id, position, title, description, target_date, status)
       VALUES ($1, 1, $2, $3, $4, 'current')
       RETURNING id`,
      [
        goal.rows[0].id,
        DEMO_MILESTONE_TITLE,
        'Read a few pages each day with Mochi cheering you on',
        '2026-12-01',
      ],
    );

    const milestoneId = milestone.rows[0].id;
    const quests = [
      ['Read 2 pages of your graded reader', 15],
      ['Write down 3 new words you noticed', 10],
      ['Say one sentence from today out loud to Mochi', 5],
    ] as const;

    for (const [title, minutes] of quests) {
      await client.query(
        `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at)
         VALUES ($1, $2, $3, $4, NULL)`,
        [milestoneId, title, today, minutes],
      );
    }

    await client.query(
      `INSERT INTO user_progress (user_id, xp, level, current_streak, best_streak)
       VALUES ($1, 0, 1, 0, 0)`,
      [userId],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export const DEMO_TITLES = {
  goal: DEMO_GOAL_TITLE,
  milestone: DEMO_MILESTONE_TITLE,
} as const;

export const DEMO_USER = {
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
} as const;
