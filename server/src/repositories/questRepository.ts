import type { Quest } from '@questline/shared';
import type { Db } from '../db/connection.js';

type QuestRow = {
  id: number;
  milestone_id: number;
  title: string;
  due_date: string;
  estimated_minutes: number | null;
  completed_at: string | null;
};

function mapQuest(row: QuestRow): Quest {
  return {
    id: row.id,
    milestone_id: row.milestone_id,
    title: row.title,
    due_date: row.due_date,
    estimated_minutes: row.estimated_minutes,
    completed_at: row.completed_at,
  };
}

export type TodayQuestContext = {
  goalTitle: string | null;
  milestoneTitle: string | null;
  quests: Quest[];
};

export function createQuestRepository(db: Db) {
  return {
    findById(id: number): Quest | null {
      const row = db
        .prepare(
          `SELECT id, milestone_id, title, due_date, estimated_minutes, completed_at
           FROM quests WHERE id = ?`,
        )
        .get(id) as QuestRow | undefined;
      return row ? mapQuest(row) : null;
    },

    listDueOnDateForActiveGoal(localDate: string): TodayQuestContext {
      const goal = db
        .prepare(`SELECT id, title FROM goals WHERE status = 'active' ORDER BY id LIMIT 1`)
        .get() as { id: number; title: string } | undefined;

      if (!goal) {
        return { goalTitle: null, milestoneTitle: null, quests: [] };
      }

      const milestone = db
        .prepare(
          `SELECT id, title FROM milestones
           WHERE goal_id = ? AND status = 'current'
           ORDER BY position LIMIT 1`,
        )
        .get(goal.id) as { id: number; title: string } | undefined;

      const rows = db
        .prepare(
          `SELECT q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at
           FROM quests q
           INNER JOIN milestones m ON m.id = q.milestone_id
           WHERE m.goal_id = ? AND q.due_date = ?
           ORDER BY q.id ASC`,
        )
        .all(goal.id, localDate) as QuestRow[];

      return {
        goalTitle: goal.title,
        milestoneTitle: milestone?.title ?? null,
        quests: rows.map(mapQuest),
      };
    },

    setCompletedAt(id: number, completedAt: string | null): Quest {
      db.prepare(`UPDATE quests SET completed_at = ? WHERE id = ?`).run(completedAt, id);
      const updated = this.findById(id);
      if (!updated) {
        throw new Error(`Quest ${id} missing after update`);
      }
      return updated;
    },
  };
}

export type QuestRepository = ReturnType<typeof createQuestRepository>;
