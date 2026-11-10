import { Router } from 'express';
import type { RoadmapService } from '../services/roadmapService.js';

export function createRoadmapRouter(roadmapService: RoadmapService): Router {
  const router = Router();

  router.get('/', (_req, res, next) => {
    try {
      const data = roadmapService.getActiveRoadmap();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
