import { extractGoalDeadlineDate, type RoadmapResponse } from '@questline/shared';
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
        goal: {
          ...response.goal,
          deadline: extractGoalDeadlineDate(response.goal.deadline),
        },
      };
    },
  };
}

export type RoadmapService = ReturnType<typeof createRoadmapService>;
