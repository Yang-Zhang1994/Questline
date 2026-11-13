import type { Milestone, ProposedQuest, Quest, RoadmapGoal } from '@questline/shared';
import { toIsoDateTime } from '../clock.js';
import type { Db } from '../db/connection.js';
import { notFound } from '../services/errors.js';

type QuestRow = {
  id: number;
  milestone_id: number;
  title: string;
  due_date: string;
  estimated_minutes: number | null;
  completed_at: Date | string | null;
};

type GoalRow = {
  id: number;
  title: string;
  done_definition: string | null;
  starting_point: string | null;
  time_budget_minutes_per_day: number | null;
  deadline: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
};

type MilestoneRow = {
  id: number;
  goal_id: number;
  position: number;
  title: string;
  description: string | null;
  target_date: string | null;
  status: 'upcoming' | 'current' | 'completed';
  total_quests?: number | string;
  done_quests?: number | string;
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

function mapGoal(row: GoalRow): RoadmapGoal {
  return {
    id: row.id,
    title: row.title,
    done_definition: row.done_definition,
    starting_point: row.starting_point,
    time_budget_minutes_per_day: row.time_budget_minutes_per_day,
    deadline: row.deadline,
    status: row.status,
  };
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
    total_quests: row.total_quests !== undefined ? Number(row.total_quests) : 0,
    done_quests: row.done_quests !== undefined ? Number(row.done_quests) : 0,
  };
}

export type TodayQuestContext = {
  goalTitle: string | null;
  milestoneTitle: string | null;
  quests: Quest[];
};

export type CurrentMilestoneContext = {
  goal: RoadmapGoal | null;
  milestone: Milestone | null;
};

export function createQuestRepository(db: Db) {
  return {
    async getCurrentMilestoneContextForUser(userId: number): Promise<CurrentMilestoneContext> {
      const goalResult = await db.query<GoalRow>(
        `SELECT id, title, done_definition, starting_point, time_budget_minutes_per_day, deadline, status
         FROM goals
         WHERE user_id = $1 AND status = 'active'
         ORDER BY id LIMIT 1`,
        [userId],
      );
      const goalRow = goalResult.rows[0];
      if (!goalRow) {
        return { goal: null, milestone: null };
      }

      const milestoneResult = await db.query<MilestoneRow>(
        `SELECT
           m.id,
           m.goal_id,
           m.position,
           m.title,
           m.description,
           m.target_date,
           m.status,
           COUNT(q.id)::int AS total_quests,
           COALESCE(SUM(CASE WHEN q.completed_at IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS done_quests
         FROM milestones m
         INNER JOIN goals g ON g.id = m.goal_id
         LEFT JOIN quests q ON q.milestone_id = m.id
         WHERE m.goal_id = $1 AND g.user_id = $2 AND m.status = 'current'
         GROUP BY m.id
         ORDER BY m.position ASC
         LIMIT 1`,
        [goalRow.id, userId],
      );
      const milestoneRow = milestoneResult.rows[0];

      return {
        goal: mapGoal(goalRow),
        milestone: milestoneRow ? mapMilestone(milestoneRow) : null,
      };
    },

    async listForMilestone(userId: number, milestoneId: number): Promise<Quest[]> {
      const result = await db.query<QuestRow>(
        `SELECT q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at
         FROM quests q
         INNER JOIN milestones m ON m.id = q.milestone_id
         INNER JOIN goals g ON g.id = m.goal_id
         WHERE q.milestone_id = $1 AND g.user_id = $2
         ORDER BY q.due_date ASC, q.id ASC`,
        [milestoneId, userId],
      );
      return result.rows.map(mapQuest);
    },

    async listForMilestoneInWindow(
      userId: number,
      milestoneId: number,
      windowStart: string,
      windowEnd: string,
    ): Promise<Quest[]> {
      const result = await db.query<QuestRow>(
        `SELECT q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at
         FROM quests q
         INNER JOIN milestones m ON m.id = q.milestone_id
         INNER JOIN goals g ON g.id = m.goal_id
         WHERE q.milestone_id = $1
           AND g.user_id = $2
           AND q.due_date >= $3
           AND q.due_date <= $4
         ORDER BY q.due_date ASC, q.id ASC`,
        [milestoneId, userId, windowStart, windowEnd],
      );
      return result.rows.map(mapQuest);
    },

    /**
     * Transactionally locks the current milestone row (`FOR UPDATE`), checks whether
     * quests already exist in `[windowStart, windowEnd]`, and invokes `proposedOrGenerator`
     * + inserts rows only if the window is still empty. Returns all quests for the milestone.
     */
    async saveGeneratedQuestsIfEmpty(
      userId: number,
      milestoneId: number,
      windowStart: string,
      windowEnd: string,
      proposedOrGenerator: ProposedQuest[] | (() => Promise<ProposedQuest[]>),
    ): Promise<Quest[]> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        const lockResult = await client.query<{ id: number }>(
          `SELECT m.id
           FROM milestones m
           INNER JOIN goals g ON g.id = m.goal_id
           WHERE m.id = $1
             AND g.user_id = $2
             AND g.status = 'active'
             AND m.status = 'current'
           FOR UPDATE`,
          [milestoneId, userId],
        );
        if (lockResult.rows.length === 0) {
          throw notFound('No current milestone found for active goal.');
        }

        const existingInWindow = await client.query<{ c: number }>(
          `SELECT COUNT(*)::int AS c
           FROM quests
           WHERE milestone_id = $1
             AND due_date >= $2
             AND due_date <= $3`,
          [milestoneId, windowStart, windowEnd],
        );

        if (Number(existingInWindow.rows[0]?.c ?? 0) === 0) {
          const proposed =
            typeof proposedOrGenerator === 'function'
              ? await proposedOrGenerator()
              : proposedOrGenerator;

          for (const item of proposed) {
            await client.query(
              `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at)
               VALUES ($1, $2, $3, $4, NULL)`,
              [milestoneId, item.title, item.due_date, item.estimated_minutes],
            );
          }
        }

        const allForMilestone = await client.query<QuestRow>(
          `SELECT id, milestone_id, title, due_date, estimated_minutes, completed_at
           FROM quests
           WHERE milestone_id = $1
           ORDER BY due_date ASC, id ASC`,
          [milestoneId],
        );

        await client.query('COMMIT');
        return allForMilestone.rows.map(mapQuest);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

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
