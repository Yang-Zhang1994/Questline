import type { RoadmapResponse } from '@questline/shared';
import type { RoadmapRepository } from '../repositories/roadmapRepository.js';

export type RoadmapServiceDeps = {
  roadmap: RoadmapRepository;
};

export function createRoadmapService(deps: RoadmapServiceDeps) {
  return {
    getActiveRoadmap(): RoadmapResponse {
      return deps.roadmap.getActiveGoalRoadmap();
    },
  };
}

export type RoadmapService = ReturnType<typeof createRoadmapService>;
