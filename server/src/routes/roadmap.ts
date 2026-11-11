import { Router } from 'express';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { RoadmapService } from '../services/roadmapService.js';
import { unauthorized } from '../services/errors.js';

export function createRoadmapRouter(roadmapService: RoadmapService): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const data = await roadmapService.getActiveRoadmap(user.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
