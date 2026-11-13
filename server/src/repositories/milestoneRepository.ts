import type { Milestone, ProposedMilestone, RoadmapGoal } from '@questline/shared';
import type { Db } from '../db/connection.js';
import { conflict, notFound } from '../services/errors.js';
import { mapGoalRowToRoadmapGoal, type RoadmapGoalRow } from './goalRepository.js';

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

export function createMilestoneRepository(db: Db) {
  return {
    async getActiveGoalForUser(userId: number): Promise<RoadmapGoal | null> {
      const result = await db.query<RoadmapGoalRow>(
        `SELECT id, title, done_definition, starting_point, time_budget_minutes_per_day, deadline, status
         FROM goals
         WHERE user_id = $1 AND status = 'active'
         ORDER BY id LIMIT 1`,
        [userId],
      );
      const row = result.rows[0];
      return row ? mapGoalRowToRoadmapGoal(row) : null;
    },

    async listMilestonesForGoal(goalId: number, userId: number): Promise<Milestone[]> {
      const result = await db.query<MilestoneRow>(
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
         WHERE m.goal_id = $1 AND g.user_id = $2
         GROUP BY m.id
         ORDER BY m.position ASC`,
        [goalId, userId],
      );
      return result.rows.map(mapMilestone);
    },

    async saveConfirmedMilestones(
      userId: number,
      goalId: number,
      proposed: ProposedMilestone[],
    ): Promise<Milestone[]> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        const ownershipCheck = await client.query<{ id: number }>(
          `SELECT id FROM goals WHERE id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE`,
          [goalId, userId],
        );
        if (ownershipCheck.rows.length === 0) {
          throw notFound('No active goal found for this user');
        }

        const existingCheck = await client.query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM milestones WHERE goal_id = $1`,
          [goalId],
        );
        if (Number(existingCheck.rows[0]?.c ?? 0) > 0) {
          throw conflict('Milestones have already been confirmed for this goal.');
        }

        const saved: Milestone[] = [];
        for (let i = 0; i < proposed.length; i += 1) {
          const item = proposed[i];
          const position = i + 1;
          const status = i === 0 ? 'current' : 'upcoming';
          const inserted = await client.query<MilestoneRow>(
            `INSERT INTO milestones (goal_id, position, title, description, target_date, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, goal_id, position, title, description, target_date, status`,
            [goalId, position, item.title, item.description, item.target_date, status],
          );
          saved.push(mapMilestone(inserted.rows[0]));
        }

        await client.query('COMMIT');
        return saved;
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
