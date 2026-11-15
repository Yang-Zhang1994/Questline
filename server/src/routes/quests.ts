import {
  ConfirmRescheduleBodySchema,
  ConfirmWeekPlanBodySchema,
  CreateQuestBodySchema,
  DeleteQuestBodySchema,
  IsoDateSchema,
  ProposeRescheduleBodySchema,
  ProposeWeekPlanBodySchema,
  ToggleQuestCompletionBodySchema,
} from '@questline/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { unauthorized } from '../services/errors.js';
import type { QuestService } from '../services/questService.js';

const QuestIdParamSchema = z.object({
  questId: z.coerce.number().int().positive('Quest id must be a positive integer'),
});

const LocalDateQuerySchema = z.object({
  local_date: IsoDateSchema.optional(),
  milestone_id: z.coerce.number().int().positive('Milestone id must be a positive integer').optional(),
});

export function createQuestsRouter(questService: QuestService): Router {
  const router = Router();
  const questGenerateLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Too many quest requests — take a soft breath and try again in a minute.',
      },
    },
  });

  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const { local_date: localDate, milestone_id: milestoneId } = LocalDateQuerySchema.parse(
        req.query,
      );
      if (milestoneId !== undefined) {
        const payload = await questService.listMilestoneQuests(user.id, milestoneId);
        res.status(200).json(payload);
        return;
      }
      const payload = await questService.getCurrentMilestoneQuests(user.id, localDate);
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', questGenerateLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const body = CreateQuestBodySchema.parse(req.body ?? {});
      const payload = await questService.createManualQuest(user.id, body);
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.post('/generate', questGenerateLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const body = LocalDateQuerySchema.parse(req.body ?? {});
      const payload = await questService.generateCurrentMilestoneQuests(user.id, body.local_date);
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.post('/week-plan/propose', questGenerateLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const body = ProposeWeekPlanBodySchema.parse(req.body ?? {});
      const payload = await questService.proposeWeekPlan(user.id, {
        local_date: body.local_date,
        feedback: body.feedback,
        current_draft: body.current_draft,
      });
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.post('/week-plan/confirm', questGenerateLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const body = ConfirmWeekPlanBodySchema.parse(req.body);
      const payload = await questService.confirmWeekPlan(user.id, {
        local_date: body.local_date,
        quests: body.quests,
      });
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.post('/reschedule/propose', questGenerateLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const body = ProposeRescheduleBodySchema.parse(req.body ?? {});
      const payload = await questService.proposeReschedule(user.id, {
        local_date: body.local_date,
        feedback: body.feedback,
        current_draft: body.current_draft,
      });
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.post('/reschedule/confirm', questGenerateLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const body = ConfirmRescheduleBodySchema.parse(req.body);
      const payload = await questService.confirmReschedule(user.id, {
        local_date: body.local_date,
        moves: body.moves,
      });
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:questId/completion', questGenerateLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const { questId } = QuestIdParamSchema.parse(req.params);
      const body = ToggleQuestCompletionBodySchema.parse(req.body);
      const payload = await questService.toggleQuestCompletion(
        user.id,
        questId,
        body.completed,
        body.local_date,
      );
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:questId', questGenerateLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const { questId } = QuestIdParamSchema.parse(req.params);
      const query = LocalDateQuerySchema.parse(req.query);
      const body = DeleteQuestBodySchema.parse(req.body ?? {});
      const localDate = query.local_date ?? body.local_date;
      const payload = await questService.deleteQuest(user.id, questId, localDate);
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
