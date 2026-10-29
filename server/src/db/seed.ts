import type { Clock } from '../clock.js';
import { formatLocalDate, systemClock, toIsoDateTime } from '../clock.js';
import type { Db } from './connection.js';

const DEMO_GOAL_TITLE = 'Read a Japanese novel on my own';
const DEMO_MILESTONE_TITLE = 'Build a tiny daily reading habit';

/**
 * Seeds one active goal, current milestone, and today's quests when the DB
 * has no goals yet — enough to demo Issue #9 check-off / undo.
 */
export function seedDemoDataIfEmpty(db: Db, clock: Clock = systemClock): void {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM goals').get() as { c: number }).c;
  if (count > 0) return;

  const now = clock.now();
  const today = formatLocalDate(now);
  const createdAt = toIsoDateTime(now);

  const insertAll = db.transaction(() => {
    const goal = db
      .prepare(
        `INSERT INTO goals (title, done_definition, starting_point, time_budget_minutes_per_day, deadline, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?)
         RETURNING id`,
      )
      .get(
        DEMO_GOAL_TITLE,
        'Finish one short Japanese novel without looking up every word',
        'Know hiragana and a few basic phrases',
        30,
        '2027-10-28',
        createdAt,
      ) as { id: number };

    const milestone = db
      .prepare(
        `INSERT INTO milestones (goal_id, position, title, description, target_date, status)
         VALUES (?, 1, ?, ?, ?, 'current')
         RETURNING id`,
      )
      .get(
        goal.id,
        DEMO_MILESTONE_TITLE,
        'Read a few pages each day with Mochi cheering you on',
        '2026-12-01',
      ) as { id: number };

    const insertQuest = db.prepare(
      `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at)
       VALUES (?, ?, ?, ?, NULL)`,
    );

    insertQuest.run(milestone.id, 'Read 2 pages of your graded reader', today, 15);
    insertQuest.run(milestone.id, 'Write down 3 new words you noticed', today, 10);
    insertQuest.run(milestone.id, 'Say one sentence from today out loud to Mochi', today, 5);
  });

  insertAll();
}

export const DEMO_TITLES = {
  goal: DEMO_GOAL_TITLE,
  milestone: DEMO_MILESTONE_TITLE,
} as const;
