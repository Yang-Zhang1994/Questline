import type { RoadmapResponse } from '@questline/shared';
import type { RoadmapRepository } from '../repositories/roadmapRepository.js';

export type RoadmapServiceDeps = {
  roadmap: RoadmapRepository;
};

export function createRoadmapService(deps: RoadmapServiceDeps) {
  return {
    async getActiveRoadmap(userId: number): Promise<RoadmapResponse> {
      return deps.roadmap.getActiveGoalRoadmapForUser(userId);
    },
  };
}

export type RoadmapService = ReturnType<typeof createRoadmapService>;
