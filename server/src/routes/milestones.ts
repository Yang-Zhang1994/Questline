import {
  ConfirmMilestonesBodySchema,
  ProposeMilestonesBodySchema,
} from '@questline/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { unauthorized, validationError } from '../services/errors.js';
import type { MilestoneAdvanceService } from '../services/milestoneAdvanceService.js';
import type { MilestoneService } from '../services/milestoneService.js';

const milestoneWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Too many milestone requests — take a soft breath and try again in a minute.',
    },
  },
});

export function createMilestonesRouter(
  milestoneService: MilestoneService,
  milestoneAdvanceService: MilestoneAdvanceService,
): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const payload = await milestoneService.getMilestonePlanState(user.id);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.post('/propose', milestoneWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const body = ProposeMilestonesBodySchema.parse(req.body ?? {});
      const payload = await milestoneService.proposeMilestones(user.id, {
        feedback: body.feedback,
        current_draft: body.current_draft,
      });
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.post('/confirm', milestoneWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const body = ConfirmMilestonesBodySchema.parse(req.body);
      const payload = await milestoneService.confirmMilestones(user.id, body.milestones);
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Mark the current stage complete and advance the roadmap (#10). */
  router.post('/:milestoneId/complete', milestoneWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const milestoneId = Number(req.params.milestoneId);
      if (!Number.isInteger(milestoneId) || milestoneId < 1) {
        throw validationError('milestoneId must be a positive integer');
      }
      const payload = await milestoneAdvanceService.completeStage(user.id, milestoneId);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
