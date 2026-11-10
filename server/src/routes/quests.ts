import { IsoDateSchema, ToggleQuestCompletionBodySchema } from '@questline/shared';
import { Router } from 'express';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { QuestService } from '../services/questService.js';
import { unauthorized, validationError } from '../services/errors.js';

export function createQuestsRouter(questService: QuestService): Router {
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
      const quest = await questService.setCompletion(user.id, questId, body.completed);
      res.json({ quest });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
