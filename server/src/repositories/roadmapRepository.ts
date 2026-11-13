import type { Milestone, RoadmapResponse } from '@questline/shared';
import type { Db } from '../db/connection.js';
import { mapGoalRowToRoadmapGoal, type RoadmapGoalRow } from './goalRepository.js';

type MilestoneRow = {
  id: number;
  goal_id: number;
  position: number;
  title: string;
  description: string | null;
  target_date: string | null;
  status: 'upcoming' | 'current' | 'completed';
  total_quests: number | string;
  done_quests: number | string;
};

export function createRoadmapRepository(db: Db) {
  return {
    async getActiveGoalRoadmapForUser(userId: number): Promise<RoadmapResponse> {
      const goalResult = await db.query<RoadmapGoalRow>(
        `SELECT id, title, done_definition, starting_point, time_budget_minutes_per_day, deadline, status
         FROM goals
         WHERE user_id = $1 AND status = 'active'
         ORDER BY id LIMIT 1`,
        [userId],
      );

      let goalRow = goalResult.rows[0];
      // After the final stage clears, fall back to the latest completed goal so Map
      // can still show “Goal reached” (#10).
      if (!goalRow) {
        const completed = await db.query<RoadmapGoalRow>(
          `SELECT id, title, done_definition, starting_point, time_budget_minutes_per_day, deadline, status
           FROM goals
           WHERE user_id = $1 AND status = 'completed'
           ORDER BY id DESC LIMIT 1`,
          [userId],
        );
        goalRow = completed.rows[0];
      }
      if (!goalRow) {
        return { goal: null, milestones: [] };
      }

      const goal = mapGoalRowToRoadmapGoal(goalRow);

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
         LEFT JOIN quests q ON q.milestone_id = m.id
         WHERE m.goal_id = $1
         GROUP BY m.id
         ORDER BY m.position ASC`,
        [goal.id],
      );

      const milestones: Milestone[] = milestoneResult.rows.map((row: MilestoneRow) => ({
        id: row.id,
        goal_id: row.goal_id,
        position: row.position,
        title: row.title,
        description: row.description,
        target_date: row.target_date,
        status: row.status,
        total_quests: Number(row.total_quests),
        done_quests: Number(row.done_quests),
      }));

      return {
        goal,
        milestones,
      };
    },
  };
}

export type RoadmapRepository = ReturnType<typeof createRoadmapRepository>;
