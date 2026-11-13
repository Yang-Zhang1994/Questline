import {
  extractGoalDeadlineDate,
  type Goal,
  type GoalDraft,
  type GoalStatus,
  type Milestone,
  type MilestoneStatus,
  type RoadmapGoal,
} from '@questline/shared';
import { toIsoDateTime } from '../clock.js';
import type { Db } from '../db/connection.js';

export type RoadmapGoalRow = {
  id: number;
  title: string;
  done_definition: string | null;
  starting_point: string | null;
  time_budget_minutes_per_day: number | null;
  deadline: string | null;
  status: GoalStatus;
};

type GoalRow = RoadmapGoalRow & {
  user_id: number;
  created_at: Date | string;
};

/**
 * Central mapper that turns a goal database row (or in-memory goal object) into the
 * `RoadmapGoal` sent to the client across `/api/quests`, `/api/roadmap`, and `/api/milestones`,
 * normalizing `deadline` to a clean `YYYY-MM-DD` date or `null`.
 */
export function mapGoalRowToRoadmapGoal(row: RoadmapGoalRow): RoadmapGoal {
  return {
    id: row.id,
    title: row.title,
    done_definition: row.done_definition,
    starting_point: row.starting_point,
    time_budget_minutes_per_day: row.time_budget_minutes_per_day,
    deadline: extractGoalDeadlineDate(row.deadline),
    status: row.status,
  };
}

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

const GOAL_COLUMNS = `id, user_id, title, done_definition, starting_point,
                time_budget_minutes_per_day, deadline, status, created_at`;

export function createGoalRepository(db: Db) {
  return {
    async findActiveForUser(userId: number): Promise<Goal | null> {
      const result = await db.query<GoalRow>(
        `SELECT ${GOAL_COLUMNS}
         FROM goals
         WHERE user_id = $1 AND status = 'active'
         LIMIT 1`,
        [userId],
      );
      const row = result.rows[0];
      return row ? mapGoal(row) : null;
    },

    async findByIdForUser(goalId: number, userId: number): Promise<Goal | null> {
      const result = await db.query<GoalRow>(
        `SELECT ${GOAL_COLUMNS}
         FROM goals
         WHERE id = $1 AND user_id = $2`,
        [goalId, userId],
      );
      const row = result.rows[0];
      return row ? mapGoal(row) : null;
    },

    /** Active / paused / completed — hide soft-archived rows from the selector. */
    async listSelectableForUser(userId: number): Promise<Goal[]> {
      const result = await db.query<GoalRow>(
        `SELECT ${GOAL_COLUMNS}
         FROM goals
         WHERE user_id = $1 AND status IN ('active', 'paused', 'completed')
         ORDER BY
           CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
           created_at DESC,
           id DESC`,
        [userId],
      );
      return result.rows.map(mapGoal);
    },

    /**
     * Insert an active Goal. Pauses any prior active goal for the user in the
     * same transaction so the one-active unique index stays happy (#18).
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
          `UPDATE goals SET status = 'paused'
           WHERE user_id = $1 AND status = 'active'`,
          [userId],
        );
        const result = await client.query<GoalRow>(
          `INSERT INTO goals (
             user_id, title, done_definition, starting_point,
             time_budget_minutes_per_day, deadline, status, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
           RETURNING ${GOAL_COLUMNS}`,
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

    /**
     * Pause the current active goal (if any) and activate `goalId`.
     * Keeps the one-active unique index happy in one transaction.
     */
    async activateForUser(goalId: number, userId: number): Promise<Goal> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        const owned = await client.query<GoalRow>(
          `SELECT ${GOAL_COLUMNS}
           FROM goals
           WHERE id = $1 AND user_id = $2
           FOR UPDATE`,
          [goalId, userId],
        );
        if (!owned.rows[0]) {
          throw new Error('GOAL_NOT_FOUND');
        }
        if (owned.rows[0].status === 'archived') {
          throw new Error('GOAL_ARCHIVED');
        }

        await client.query(
          `UPDATE goals SET status = 'paused'
           WHERE user_id = $1 AND status = 'active' AND id <> $2`,
          [userId, goalId],
        );

        const result = await client.query<GoalRow>(
          `UPDATE goals SET status = 'active'
           WHERE id = $1 AND user_id = $2
           RETURNING ${GOAL_COLUMNS}`,
          [goalId, userId],
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

    /** Soft-pause the active goal so a new interview / confirm can take the slot. */
    async pauseActiveForUser(userId: number): Promise<Goal | null> {
      const result = await db.query<GoalRow>(
        `UPDATE goals SET status = 'paused'
         WHERE user_id = $1 AND status = 'active'
         RETURNING ${GOAL_COLUMNS}`,
        [userId],
      );
      const row = result.rows[0];
      return row ? mapGoal(row) : null;
    },

    /**
     * Hard-delete a goal (CASCADE milestones + quests + diary notes).
     * If it was active, promote the newest paused/completed goal when present.
     */
    async deleteForUser(
      goalId: number,
      userId: number,
    ): Promise<{ deleted: Goal; active: Goal | null }> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        const owned = await client.query<GoalRow>(
          `SELECT ${GOAL_COLUMNS}
           FROM goals
           WHERE id = $1 AND user_id = $2
           FOR UPDATE`,
          [goalId, userId],
        );
        if (!owned.rows[0]) {
          throw new Error('GOAL_NOT_FOUND');
        }
        const deleted = mapGoal(owned.rows[0]);
        const wasActive = deleted.status === 'active';

        await client.query(`DELETE FROM goals WHERE id = $1 AND user_id = $2`, [
          goalId,
          userId,
        ]);

        let active: Goal | null = null;
        if (wasActive) {
          const next = await client.query<GoalRow>(
            `SELECT ${GOAL_COLUMNS}
             FROM goals
             WHERE user_id = $1 AND status IN ('paused', 'completed')
             ORDER BY created_at DESC, id DESC
             LIMIT 1
             FOR UPDATE`,
            [userId],
          );
          if (next.rows[0]) {
            const promoted = await client.query<GoalRow>(
              `UPDATE goals SET status = 'active'
               WHERE id = $1
               RETURNING ${GOAL_COLUMNS}`,
              [next.rows[0].id],
            );
            active = mapGoal(promoted.rows[0]);
          }
        } else {
          const current = await client.query<GoalRow>(
            `SELECT ${GOAL_COLUMNS}
             FROM goals
             WHERE user_id = $1 AND status = 'active'
             LIMIT 1`,
            [userId],
          );
          active = current.rows[0] ? mapGoal(current.rows[0]) : null;
        }

        await client.query('COMMIT');
        return { deleted, active };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    /**
     * Manual plan fallback (#21): pause any active goal, insert a new active goal
     * plus ordered milestones in one transaction (confirm-before-save = form submit).
     */
    async createManualPlan(
      userId: number,
      input: {
        title: string;
        concrete_goal: string | null;
        deadline: string | null;
        milestones: Array<{
          position: number;
          title: string;
          description: string | null;
          target_date: string | null;
        }>;
        createdAt: string;
      },
    ): Promise<{ goal: Goal; milestones: Milestone[] }> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `UPDATE goals SET status = 'paused'
           WHERE user_id = $1 AND status = 'active'`,
          [userId],
        );

        const goalResult = await client.query<GoalRow>(
          `INSERT INTO goals (
             user_id, title, done_definition, starting_point,
             time_budget_minutes_per_day, deadline, status, created_at
           ) VALUES ($1, $2, $3, NULL, NULL, $4, 'active', $5)
           RETURNING ${GOAL_COLUMNS}`,
          [userId, input.title, input.concrete_goal, input.deadline, input.createdAt],
        );
        const goal = mapGoal(goalResult.rows[0]);

        type MilestoneRow = {
          id: number;
          goal_id: number;
          position: number;
          title: string;
          description: string | null;
          target_date: string | null;
          status: MilestoneStatus;
        };

        const milestones: Milestone[] = [];
        for (const item of input.milestones) {
          const status: MilestoneStatus = item.position === 1 ? 'current' : 'upcoming';
          const inserted = await client.query<MilestoneRow>(
            `INSERT INTO milestones (goal_id, position, title, description, target_date, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, goal_id, position, title, description, target_date, status`,
            [
              goal.id,
              item.position,
              item.title,
              item.description,
              item.target_date,
              status,
            ],
          );
          const row = inserted.rows[0];
          milestones.push({
            id: row.id,
            goal_id: row.goal_id,
            position: row.position,
            title: row.title,
            description: row.description,
            target_date: row.target_date,
            status: row.status,
            total_quests: 0,
            done_quests: 0,
          });
        }

        await client.query('COMMIT');
        return { goal, milestones };
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
