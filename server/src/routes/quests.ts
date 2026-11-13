import { ToggleQuestCompletionBodySchema } from '@questline/shared';
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

const questGenerateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Too many quest requests — take a soft breath and try again in a minute.',
    },
  },
});

export function createQuestsRouter(questService: QuestService): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const payload = await questService.getCurrentMilestoneQuests(user.id);
      res.status(200).json(payload);
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
      const payload = await questService.generateCurrentMilestoneQuests(user.id);
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
      const payload = await questService.toggleQuestCompletion(user.id, questId, body.completed);
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
