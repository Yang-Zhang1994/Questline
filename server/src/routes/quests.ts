import {
  ConfirmQuestPlanBodySchema,
  IsoDateSchema,
  ReviseQuestPlanBodySchema,
  ToggleQuestCompletionBodySchema,
} from '@questline/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { QuestPlanService } from '../services/questPlanService.js';
import type { QuestService } from '../services/questService.js';
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

export function createQuestsRouter(
  questService: QuestService,
  questPlanService?: QuestPlanService,
): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/today', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }

      const raw = req.query.local_date;
      let localDate: string | undefined;
      if (typeof raw === 'string' && raw.length > 0) {
        const parsed = IsoDateSchema.safeParse(raw);
        if (!parsed.success) {
          throw validationError('local_date must be YYYY-MM-DD');
        }
        localDate = parsed.data;
      }
      const payload = await questService.getToday(user.id, localDate);
      res.json(payload);
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

  return router;
}
