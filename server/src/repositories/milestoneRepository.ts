import type {
  Milestone,
  MilestoneGoalSummary,
  MilestonePlanDraft,
  MilestoneStatus,
} from '@questline/shared';
import type { Db } from '../db/connection.js';

type GoalRow = {
  id: number;
  title: string;
  done_definition: string | null;
  starting_point: string | null;
  time_budget_minutes_per_day: number | null;
  deadline: string | null;
  milestone_draft: MilestonePlanDraft | string | null;
};

type MilestoneRow = {
  id: number;
  goal_id: number;
  position: number;
  title: string;
  description: string | null;
  target_date: string | null;
  status: MilestoneStatus;
};

function mapGoalSummary(row: GoalRow): MilestoneGoalSummary {
  return {
    id: row.id,
    title: row.title,
    done_definition: row.done_definition,
    starting_point: row.starting_point,
    time_budget_minutes_per_day: row.time_budget_minutes_per_day,
    deadline: row.deadline,
  };
}

function parseDraft(raw: GoalRow['milestone_draft']): MilestonePlanDraft | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as MilestonePlanDraft;
    } catch {
      return null;
    }
  }
  return raw;
}

function mapMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    goal_id: row.goal_id,
    position: row.position,
    title: row.title,
    description: row.description,
    target_date: row.target_date,
    status: row.status,
  };
}

export type ActiveGoalPlanRecord = {
  goal: MilestoneGoalSummary;
  draft: MilestonePlanDraft | null;
};

export function createMilestoneRepository(db: Db) {
  return {
    async findActiveGoalPlan(userId: number): Promise<ActiveGoalPlanRecord | null> {
      const result = await db.query<GoalRow>(
        `SELECT id, title, done_definition, starting_point,
                time_budget_minutes_per_day, deadline, milestone_draft
         FROM goals
         WHERE user_id = $1 AND status = 'active'
         LIMIT 1`,
        [userId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return { goal: mapGoalSummary(row), draft: parseDraft(row.milestone_draft) };
    },

    /**
     * Prefer the active goal; fall back to the most recent completed goal so Map
     * can still show a finished roadmap after the final stage clears (#10).
     */
    async findGoalPlanForMap(userId: number): Promise<ActiveGoalPlanRecord | null> {
      const result = await db.query<GoalRow>(
        `SELECT id, title, done_definition, starting_point,
                time_budget_minutes_per_day, deadline, milestone_draft
         FROM goals
         WHERE user_id = $1 AND status IN ('active', 'completed')
         ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, id DESC
         LIMIT 1`,
        [userId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return { goal: mapGoalSummary(row), draft: parseDraft(row.milestone_draft) };
    },

    async saveDraft(goalId: number, userId: number, draft: MilestonePlanDraft | null): Promise<void> {
      const result = await db.query(
        `UPDATE goals
         SET milestone_draft = $1::jsonb
         WHERE id = $2 AND user_id = $3 AND status = 'active'`,
        [draft ? JSON.stringify(draft) : null, goalId, userId],
      );
      if (result.rowCount !== 1) {
        throw new Error('Active goal not found while saving milestone draft');
      }
    },

    async listForGoal(goalId: number): Promise<Milestone[]> {
      const result = await db.query<MilestoneRow>(
        `SELECT id, goal_id, position, title, description, target_date, status
         FROM milestones
         WHERE goal_id = $1
         ORDER BY position ASC`,
        [goalId],
      );
      return result.rows.map(mapMilestone);
    },

    /**
     * Confirm-before-save write path: replace all milestones for the goal and clear the draft.
     * First stage becomes `current`; the rest `upcoming`. Quests cascade-delete with old rows.
     */
    async confirmPlan(
      goalId: number,
      userId: number,
      draft: MilestonePlanDraft,
    ): Promise<Milestone[]> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const owned = await client.query<{ id: number }>(
          `SELECT id FROM goals WHERE id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE`,
          [goalId, userId],
        );
        if (!owned.rows[0]) {
          throw new Error('Active goal not found while confirming milestone plan');
        }

        await client.query(`DELETE FROM milestones WHERE goal_id = $1`, [goalId]);

        const saved: Milestone[] = [];
        for (const item of draft.milestones) {
          const status: MilestoneStatus = item.position === 1 ? 'current' : 'upcoming';
          const inserted = await client.query<MilestoneRow>(
            `INSERT INTO milestones (goal_id, position, title, description, target_date, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, goal_id, position, title, description, target_date, status`,
            [goalId, item.position, item.title, item.description, item.target_date, status],
          );
          saved.push(mapMilestone(inserted.rows[0]));
        }

        await client.query(
          `UPDATE goals SET milestone_draft = NULL WHERE id = $1 AND user_id = $2`,
          [goalId, userId],
        );

        await client.query('COMMIT');
        return saved;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    /**
     * Confirm stage clear (#10): mark current → completed, next → current
     * (or complete the goal when no next stage remains).
     * Caller must already have verified all quests on this milestone are done.
     */
    async completeCurrentAndAdvance(
      userId: number,
      milestoneId: number,
    ): Promise<{
      completed: Milestone;
      next: Milestone | null;
      goalCompleted: boolean;
      goal: MilestoneGoalSummary;
      milestones: Milestone[];
    }> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        const owned = await client.query<
          MilestoneRow & {
            goal_title: string;
            done_definition: string | null;
            starting_point: string | null;
            time_budget_minutes_per_day: number | null;
            deadline: string | null;
          }
        >(
          `SELECT m.id, m.goal_id, m.position, m.title, m.description, m.target_date, m.status,
                  g.title AS goal_title, g.done_definition, g.starting_point,
                  g.time_budget_minutes_per_day, g.deadline
           FROM milestones m
           INNER JOIN goals g ON g.id = m.goal_id
           WHERE m.id = $1
             AND g.user_id = $2
             AND g.status = 'active'
           FOR UPDATE OF m, g`,
          [milestoneId, userId],
        );
        const row = owned.rows[0];
        if (!row) {
          throw new Error('MILESTONE_NOT_FOUND');
        }
        if (row.status !== 'current') {
          throw new Error('MILESTONE_NOT_CURRENT');
        }

        const incomplete = await client.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM quests
           WHERE milestone_id = $1 AND completed_at IS NULL`,
          [milestoneId],
        );
        if (Number(incomplete.rows[0].c) > 0) {
          throw new Error('MILESTONE_QUESTS_INCOMPLETE');
        }
        const totalQuests = await client.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM quests WHERE milestone_id = $1`,
          [milestoneId],
        );
        if (Number(totalQuests.rows[0].c) === 0) {
          throw new Error('MILESTONE_QUESTS_EMPTY');
        }

        const completedResult = await client.query<MilestoneRow>(
          `UPDATE milestones
           SET status = 'completed'
           WHERE id = $1
           RETURNING id, goal_id, position, title, description, target_date, status`,
          [milestoneId],
        );
        const completed = mapMilestone(completedResult.rows[0]);

        const nextResult = await client.query<MilestoneRow>(
          `SELECT id, goal_id, position, title, description, target_date, status
           FROM milestones
           WHERE goal_id = $1 AND position > $2
           ORDER BY position ASC
           LIMIT 1
           FOR UPDATE`,
          [row.goal_id, row.position],
        );
        const nextRow = nextResult.rows[0];
        let next: Milestone | null = null;
        let goalCompleted = false;

        if (nextRow) {
          const advanced = await client.query<MilestoneRow>(
            `UPDATE milestones
             SET status = 'current', quest_draft = NULL
             WHERE id = $1
             RETURNING id, goal_id, position, title, description, target_date, status`,
            [nextRow.id],
          );
          next = mapMilestone(advanced.rows[0]);
        } else {
          await client.query(
            `UPDATE goals SET status = 'completed', milestone_draft = NULL
             WHERE id = $1 AND user_id = $2`,
            [row.goal_id, userId],
          );
          goalCompleted = true;
        }

        const list = await client.query<MilestoneRow>(
          `SELECT id, goal_id, position, title, description, target_date, status
           FROM milestones
           WHERE goal_id = $1
           ORDER BY position ASC`,
          [row.goal_id],
        );

        await client.query('COMMIT');
        return {
          completed,
          next,
          goalCompleted,
          goal: {
            id: row.goal_id,
            title: row.goal_title,
            done_definition: row.done_definition,
            starting_point: row.starting_point,
            time_budget_minutes_per_day: row.time_budget_minutes_per_day,
            deadline: row.deadline,
          },
          milestones: list.rows.map(mapMilestone),
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

export type MilestoneRepository = ReturnType<typeof createMilestoneRepository>;
