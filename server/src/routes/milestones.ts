import {
  ConfirmMilestonePlanBodySchema,
  ReviseMilestonePlanBodySchema,
} from '@questline/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { MilestonePlanService } from '../services/milestonePlanService.js';
import { unauthorized } from '../services/errors.js';

const milestoneWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Too many milestone drafts — take a soft breath and try again in a minute.',
    },
  },
});

export function createMilestonesRouter(milestonePlanService: MilestonePlanService): Router {
  const router = Router();

  router.use(requireAuth);

  /** Load cached draft / confirmed milestones for the active goal. */
  router.get('/draft', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const payload = await milestonePlanService.getPlan(user.id);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Propose a 3–7 milestone draft — does NOT write `milestones` rows. */
  router.post('/draft', milestoneWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const payload = await milestonePlanService.proposePlan(user.id);
      const status = payload.draft && !payload.confirmed ? 201 : 200;
      res.status(status).json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Ask Mochi to add/remove/rename/reorder — still a draft until confirm. */
  router.post('/draft/revise', milestoneWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const body = ReviseMilestonePlanBodySchema.parse(req.body ?? {});
      const payload = await milestonePlanService.revisePlan(user.id, body.feedback);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Accept — only path that INSERTs into `milestones`. */
  router.post('/confirm', milestoneWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const body = ConfirmMilestonePlanBodySchema.parse(req.body);
      const payload = await milestonePlanService.confirmPlan(user.id, body.draft);
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
