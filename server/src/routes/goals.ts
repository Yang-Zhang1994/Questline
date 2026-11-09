import {
  ConfirmGoalBodySchema,
  ReviseGoalDraftBodySchema,
} from '@questline/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { GoalService } from '../services/goalService.js';
import { unauthorized } from '../services/errors.js';

const goalWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Too many goal drafts — take a soft breath and try again in a minute.',
    },
  },
});

export function createGoalsRouter(goalService: GoalService): Router {
  const router = Router();

  router.use(requireAuth);

  /** Load cached draft (null if not proposed yet). */
  router.get('/draft', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const payload = await goalService.getDraft(user.id);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Propose a draft from completed interview answers — does NOT save a Goal. */
  router.post('/draft', goalWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const payload = await goalService.proposeDraft(user.id);
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Ask Mochi to revise the draft — still not saved. */
  router.post('/draft/revise', goalWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const body = ReviseGoalDraftBodySchema.parse(req.body ?? {});
      const payload = await goalService.reviseDraft(user.id, body.feedback);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  /**
   * Return to the interview to tweak answers (clears draft, keeps prior answers).
   * Assignment: revise can return to interview.
   */
  router.post('/draft/return-to-interview', goalWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const payload = await goalService.returnToInterview(user.id);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Accept — only path that INSERTs into `goals`. */
  router.post('/confirm', goalWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const body = ConfirmGoalBodySchema.parse(req.body);
      const payload = await goalService.confirmDraft(user.id, body.draft);
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
