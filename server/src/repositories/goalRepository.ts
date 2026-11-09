import type { Goal, GoalDraft, GoalStatus } from '@questline/shared';
import { toIsoDateTime } from '../clock.js';
import type { Db } from '../db/connection.js';

type GoalRow = {
  id: number;
  user_id: number;
  title: string;
  done_definition: string | null;
  starting_point: string | null;
  time_budget_minutes_per_day: number | null;
  deadline: string | null;
  status: GoalStatus;
  created_at: Date | string;
};

function mapCreatedAt(value: Date | string): string {
  if (value instanceof Date) return toIsoDateTime(value);
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return value;
  return toIsoDateTime(asDate);
}

function mapGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    done_definition: row.done_definition,
    starting_point: row.starting_point,
    time_budget_minutes_per_day: row.time_budget_minutes_per_day,
    deadline: row.deadline,
    status: row.status,
    created_at: mapCreatedAt(row.created_at),
  };
}

export function createGoalRepository(db: Db) {
  return {
    async findActiveForUser(userId: number): Promise<Goal | null> {
      const result = await db.query<GoalRow>(
        `SELECT id, user_id, title, done_definition, starting_point,
                time_budget_minutes_per_day, deadline, status, created_at
         FROM goals
         WHERE user_id = $1 AND status = 'active'
         LIMIT 1`,
        [userId],
      );
      const row = result.rows[0];
      return row ? mapGoal(row) : null;
    },

    /**
     * Insert an active Goal. Archives any prior active goal for the user in the
     * same transaction so the one-active unique index stays happy (demo seed).
     */
    async insertActiveFromDraft(
      userId: number,
      draft: GoalDraft,
      createdAt: string,
    ): Promise<Goal> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE goals SET status = 'archived'
           WHERE user_id = $1 AND status = 'active'`,
          [userId],
        );
        const result = await client.query<GoalRow>(
          `INSERT INTO goals (
             user_id, title, done_definition, starting_point,
             time_budget_minutes_per_day, deadline, status, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
           RETURNING id, user_id, title, done_definition, starting_point,
                     time_budget_minutes_per_day, deadline, status, created_at`,
          [
            userId,
            draft.title,
            draft.done_definition,
            draft.starting_point,
            draft.time_budget_minutes_per_day,
            draft.deadline,
            createdAt,
          ],
        );
        await client.query('COMMIT');
        return mapGoal(result.rows[0]);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

export type GoalRepository = ReturnType<typeof createGoalRepository>;
