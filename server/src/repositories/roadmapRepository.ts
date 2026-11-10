import type { Milestone, RoadmapGoal, RoadmapResponse } from '@questline/shared';
import type { Db } from '../db/connection.js';

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
  total_quests: number;
  done_quests: number;
};

export function createRoadmapRepository(db: Db) {
  return {
    getActiveGoalRoadmap(): RoadmapResponse {
      const goalRow = db
        .prepare(
          `SELECT id, title, done_definition, starting_point, time_budget_minutes_per_day, deadline, status
           FROM goals
           WHERE status = 'active'
           ORDER BY id LIMIT 1`,
        )
        .get() as GoalRow | undefined;

      if (!goalRow) {
        return { goal: null, milestones: [] };
      }

      const goal: RoadmapGoal = {
        id: goalRow.id,
        title: goalRow.title,
        done_definition: goalRow.done_definition,
        starting_point: goalRow.starting_point,
        time_budget_minutes_per_day: goalRow.time_budget_minutes_per_day,
        deadline: goalRow.deadline,
        status: goalRow.status,
      };

      const milestoneRows = db
        .prepare(
          `SELECT
             m.id,
             m.goal_id,
             m.position,
             m.title,
             m.description,
             m.target_date,
             m.status,
             COUNT(q.id) AS total_quests,
             SUM(CASE WHEN q.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS done_quests
           FROM milestones m
           LEFT JOIN quests q ON q.milestone_id = m.id
           WHERE m.goal_id = ?
           GROUP BY m.id
           ORDER BY m.position ASC`,
        )
        .all(goal.id) as MilestoneRow[];

      const milestones: Milestone[] = milestoneRows.map((row) => ({
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
