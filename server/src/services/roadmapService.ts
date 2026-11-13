import type { RoadmapResponse } from '@questline/shared';
import { mapGoalRowToRoadmapGoal } from '../repositories/goalRepository.js';
import type { RoadmapRepository } from '../repositories/roadmapRepository.js';

export type RoadmapServiceDeps = {
  roadmap: RoadmapRepository;
};

export function createRoadmapService(deps: RoadmapServiceDeps) {
  return {
    async getActiveRoadmap(userId: number): Promise<RoadmapResponse> {
      const response = await deps.roadmap.getActiveGoalRoadmapForUser(userId);
      if (!response.goal) {
        return response;
      }
      return {
        ...response,
        goal: mapGoalRowToRoadmapGoal({
          id: response.goal.id,
          title: response.goal.title,
          done_definition: response.goal.done_definition ?? null,
          starting_point: response.goal.starting_point ?? null,
          time_budget_minutes_per_day: response.goal.time_budget_minutes_per_day ?? null,
          deadline: response.goal.deadline,
          status: response.goal.status,
        }),
      };
    },
  };
}

export type RoadmapService = ReturnType<typeof createRoadmapService>;
