import {
  ConfirmGoalBodySchema,
  ManualPlanBodySchema,
  ReviseGoalDraftBodySchema,
} from '@questline/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { GoalService } from '../services/goalService.js';
import { unauthorized, validationError } from '../services/errors.js';

const goalWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Too many goal changes — take a soft breath and try again in a minute.',
    },
  },
});

function parseGoalId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw validationError('goal id must be a positive integer');
  }
  return id;
}

export function createGoalsRouter(goalService: GoalService): Router {
  const router = Router();

  router.use(requireAuth);

  /** List selectable goals + which one is active for Today / Map / Talk (#18). */
  router.get('/', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const payload = await goalService.listGoals(user.id);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  /**
   * Pause the current active goal and restart the Mochi interview
   * so the user can start another goal without deleting others (#18).
   */
  router.post('/new', goalWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const payload = await goalService.startNewGoal(user.id);
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

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

  /**
   * Manual plan form fallback (#21): create goal + milestones without chatting.
   * Submit is the confirm-before-save step.
   */
  router.post('/manual-plan', goalWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const parsed = ManualPlanBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw validationError(
          'Give your goal a little name and at least one milestone (one per line) ♡',
        );
      }
      const payload = await goalService.createManualPlan(user.id, parsed.data);
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Switch the active goal (Today / Map / Talk follow this). */
  router.patch('/:id/activate', goalWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const goalId = parseGoalId(req.params.id);
      const payload = await goalService.activateGoal(user.id, goalId);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Delete a goal after UI confirmation — cascades milestones + quests. */
  router.delete('/:id', goalWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const goalId = parseGoalId(req.params.id);
      const payload = await goalService.deleteGoal(user.id, goalId);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
