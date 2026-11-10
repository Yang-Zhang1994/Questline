import type { Quest } from '@questline/shared';
import { toIsoDateTime } from '../clock.js';
import type { Db } from '../db/connection.js';

type QuestRow = {
  id: number;
  milestone_id: number;
  title: string;
  due_date: string;
  estimated_minutes: number | null;
  completed_at: Date | string | null;
};

function mapCompletedAt(value: Date | string | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) return toIsoDateTime(value);
  // pg may return timestamptz as string depending on parsers
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return value;
  return toIsoDateTime(asDate);
}

function mapQuest(row: QuestRow): Quest {
  return {
    id: row.id,
    milestone_id: row.milestone_id,
    title: row.title,
    due_date: row.due_date,
    estimated_minutes: row.estimated_minutes,
    completed_at: mapCompletedAt(row.completed_at),
  };
}

export type TodayQuestContext = {
  goalTitle: string | null;
  milestoneTitle: string | null;
  quests: Quest[];
};

export function createQuestRepository(db: Db) {
  return {
    async findByIdForUser(userId: number, id: number): Promise<Quest | null> {
      const result = await db.query<QuestRow>(
        `SELECT q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at
         FROM quests q
         INNER JOIN milestones m ON m.id = q.milestone_id
         INNER JOIN goals g ON g.id = m.goal_id
         WHERE q.id = $1 AND g.user_id = $2`,
        [id, userId],
      );
      const row = result.rows[0];
      return row ? mapQuest(row) : null;
    },

    async listDueOnDateForActiveGoal(userId: number, localDate: string): Promise<TodayQuestContext> {
      const goalResult = await db.query<{ id: number; title: string }>(
        `SELECT id, title FROM goals
         WHERE user_id = $1 AND status = 'active'
         ORDER BY id LIMIT 1`,
        [userId],
      );
      const goal = goalResult.rows[0];

      if (!goal) {
        return { goalTitle: null, milestoneTitle: null, quests: [] };
      }

      const milestoneResult = await db.query<{ id: number; title: string }>(
        `SELECT id, title FROM milestones
         WHERE goal_id = $1 AND status = 'current'
         ORDER BY position LIMIT 1`,
        [goal.id],
      );
      const milestone = milestoneResult.rows[0];

      const questResult = await db.query<QuestRow>(
        `SELECT q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at
         FROM quests q
         INNER JOIN milestones m ON m.id = q.milestone_id
         WHERE m.goal_id = $1 AND q.due_date = $2
         ORDER BY q.id ASC`,
        [goal.id, localDate],
      );

      return {
        goalTitle: goal.title,
        milestoneTitle: milestone?.title ?? null,
        quests: questResult.rows.map(mapQuest),
      };
    },

    async setCompletedAtForUser(
      userId: number,
      id: number,
      completedAt: string | null,
    ): Promise<Quest | null> {
      const result = await db.query<QuestRow>(
        `UPDATE quests q
         SET completed_at = $1
         FROM milestones m
         INNER JOIN goals g ON g.id = m.goal_id
         WHERE q.id = $2
           AND q.milestone_id = m.id
           AND g.user_id = $3
         RETURNING q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at`,
        [completedAt, id, userId],
      );
      const row = result.rows[0];
      return row ? mapQuest(row) : null;
    },
  };
}

export type QuestRepository = ReturnType<typeof createQuestRepository>;
