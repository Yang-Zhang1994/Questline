import {
  ConfirmQuestPlanBodySchema,
  ConfirmRescheduleBodySchema,
  ConfirmWeekPlanBodySchema,
  CreateQuestBodySchema,
  DeleteQuestBodySchema,
  IsoDateSchema,
  ReviseQuestPlanBodySchema,
  ReviseRescheduleBodySchema,
  ReviseWeekPlanBodySchema,
  ToggleQuestCompletionBodySchema,
} from '@questline/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { QuestPlanService } from '../services/questPlanService.js';
import type { QuestService } from '../services/questService.js';
import type { RescheduleService } from '../services/rescheduleService.js';
import type { WeekPlanService } from '../services/weekPlanService.js';
import { unauthorized, validationError } from '../services/errors.js';

const questWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Too many quest drafts — take a soft breath and try again in a minute.',
    },
  },
});

function parseOptionalLocalDate(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const parsed = IsoDateSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationError('local_date must be YYYY-MM-DD');
  }
  return parsed.data;
}

export function createQuestsRouter(
  questService: QuestService,
  questPlanService?: QuestPlanService,
  rescheduleService?: RescheduleService,
  weekPlanService?: WeekPlanService,
): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/today', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }

      const localDate = parseOptionalLocalDate(req.query.local_date);
      const payload = await questService.getToday(user.id, localDate);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** List quests for one milestone (Map sheet — Issue #20). */
  router.get('/', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();

      const raw = req.query.milestone_id;
      const milestoneId = typeof raw === 'string' ? Number(raw) : NaN;
      if (!Number.isInteger(milestoneId) || milestoneId < 1) {
        throw validationError('milestone_id must be a positive integer');
      }
      const payload = await questService.listForMilestone(user.id, milestoneId);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Manual create — immediate write, no AI draft (Issue #20). */
  router.post('/', questWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const body = CreateQuestBodySchema.parse(req.body);
      const payload = await questService.createManual(user.id, {
        milestoneId: body.milestone_id,
        title: body.title,
        dueDate: body.due_date,
        estimatedMinutes: body.estimated_minutes,
      });
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  if (questPlanService) {
    /** Load cached draft / confirmed quests for the current milestone. */
    router.get('/draft', async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const payload = await questPlanService.getPlan(user.id);
        res.json(payload);
      } catch (err) {
        next(err);
      }
    });

    /** Propose a quest draft for the current milestone — does NOT write `quests` rows. */
    router.post('/draft', questWriteLimiter, async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const payload = await questPlanService.proposePlan(user.id);
        const status = payload.draft && !payload.confirmed ? 201 : 200;
        res.status(status).json(payload);
      } catch (err) {
        next(err);
      }
    });

    /** Ask Mochi to tweak the draft — still a draft until confirm. */
    router.post('/draft/revise', questWriteLimiter, async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const body = ReviseQuestPlanBodySchema.parse(req.body ?? {});
        const payload = await questPlanService.revisePlan(user.id, body.feedback);
        res.json(payload);
      } catch (err) {
        next(err);
      }
    });

    /** Accept — only path that INSERTs into `quests`. */
    router.post('/confirm', questWriteLimiter, async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const body = ConfirmQuestPlanBodySchema.parse(req.body);
        const payload = await questPlanService.confirmPlan(user.id, body.draft);
        res.status(201).json(payload);
      } catch (err) {
        next(err);
      }
    });
  }

  if (rescheduleService) {
    /** Load cached reschedule draft + overdue list (Issue #14). */
    router.get('/reschedule', async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const localDate = parseOptionalLocalDate(req.query.local_date);
        const payload = await rescheduleService.getPlan(user.id, localDate);
        res.json(payload);
      } catch (err) {
        next(err);
      }
    });

    /** Propose a reschedule draft — does NOT rewrite quest due_dates. */
    router.post('/reschedule', questWriteLimiter, async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const localDate = parseOptionalLocalDate(
          (req.body as { local_date?: unknown } | undefined)?.local_date ??
            req.query.local_date,
        );
        const payload = await rescheduleService.proposePlan(user.id, localDate);
        const status = payload.draft ? 201 : 200;
        res.status(status).json(payload);
      } catch (err) {
        next(err);
      }
    });

    /** Ask Mochi to tweak the preview — still a draft until confirm. */
    router.post('/reschedule/revise', questWriteLimiter, async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const body = ReviseRescheduleBodySchema.parse(req.body ?? {});
        const localDate = parseOptionalLocalDate(
          (req.body as { local_date?: unknown } | undefined)?.local_date,
        );
        const payload = await rescheduleService.revisePlan(
          user.id,
          body.feedback,
          localDate,
        );
        res.json(payload);
      } catch (err) {
        next(err);
      }
    });

    /** Accept — only path that UPDATEs existing quest due_dates. */
    router.post('/reschedule/confirm', questWriteLimiter, async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const body = ConfirmRescheduleBodySchema.parse(req.body);
        const localDate = parseOptionalLocalDate(
          (req.body as { local_date?: unknown } | undefined)?.local_date,
        );
        const payload = await rescheduleService.confirmPlan(
          user.id,
          body.draft,
          localDate,
        );
        res.status(201).json(payload);
      } catch (err) {
        next(err);
      }
    });
  }

  if (weekPlanService) {
    /** Load cached week plan draft + existing milestone quests (Issue #15). */
    router.get('/week-plan', async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const localDate = parseOptionalLocalDate(req.query.local_date);
        const payload = await weekPlanService.getPlan(user.id, localDate);
        res.json(payload);
      } catch (err) {
        next(err);
      }
    });

    /** Propose a week plan draft — does NOT INSERT quest rows. */
    router.post('/week-plan', questWriteLimiter, async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const localDate = parseOptionalLocalDate(
          (req.body as { local_date?: unknown } | undefined)?.local_date ??
            req.query.local_date,
        );
        const payload = await weekPlanService.proposePlan(user.id, localDate);
        const status = payload.draft ? 201 : 200;
        res.status(status).json(payload);
      } catch (err) {
        next(err);
      }
    });

    /** Ask Mochi to tweak the preview — still a draft until confirm. */
    router.post('/week-plan/revise', questWriteLimiter, async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const body = ReviseWeekPlanBodySchema.parse(req.body ?? {});
        const localDate = parseOptionalLocalDate(
          (req.body as { local_date?: unknown } | undefined)?.local_date,
        );
        const payload = await weekPlanService.revisePlan(
          user.id,
          body.feedback,
          localDate,
        );
        res.json(payload);
      } catch (err) {
        next(err);
      }
    });

    /** Accept — only path that INSERTs new week-plan quest rows. */
    router.post('/week-plan/confirm', questWriteLimiter, async (req, res, next) => {
      try {
        const user = getRequestUser(req);
        if (!user) throw unauthorized();
        const body = ConfirmWeekPlanBodySchema.parse(req.body);
        const localDate = parseOptionalLocalDate(
          (req.body as { local_date?: unknown } | undefined)?.local_date,
        );
        const payload = await weekPlanService.confirmPlan(
          user.id,
          body.draft,
          localDate,
        );
        res.status(201).json(payload);
      } catch (err) {
        next(err);
      }
    });
  }

  router.patch('/:questId/completion', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }

      const questId = Number(req.params.questId);
      if (!Number.isInteger(questId) || questId < 1) {
        throw validationError('questId must be a positive integer');
      }
      const body = ToggleQuestCompletionBodySchema.parse(req.body);
      const payload = await questService.setCompletion(
        user.id,
        questId,
        body.completed,
        body.local_date,
      );
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Delete a quest; completed ones reverse XP first (Issue #20). */
  router.delete('/:questId', questWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();

      const questId = Number(req.params.questId);
      if (!Number.isInteger(questId) || questId < 1) {
        throw validationError('questId must be a positive integer');
      }
      const fromQuery = parseOptionalLocalDate(req.query.local_date);
      const body = DeleteQuestBodySchema.parse(req.body ?? {});
      const payload = await questService.deleteManual(
        user.id,
        questId,
        body.local_date ?? fromQuery,
      );
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
