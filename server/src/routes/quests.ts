import { IsoDateSchema, ToggleQuestCompletionBodySchema } from '@questline/shared';
import { Router } from 'express';
import type { QuestService } from '../services/questService.js';
import { validationError } from '../services/errors.js';

export function createQuestsRouter(questService: QuestService): Router {
  const router = Router();

  router.get('/today', (req, res, next) => {
    try {
      const raw = req.query.local_date;
      let localDate: string | undefined;
      if (typeof raw === 'string' && raw.length > 0) {
        const parsed = IsoDateSchema.safeParse(raw);
        if (!parsed.success) {
          throw validationError('local_date must be YYYY-MM-DD');
        }
        localDate = parsed.data;
      }
      const payload = questService.getToday(localDate);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:questId/completion', (req, res, next) => {
    try {
      const questId = Number(req.params.questId);
      if (!Number.isInteger(questId) || questId < 1) {
        throw validationError('questId must be a positive integer');
      }
      const body = ToggleQuestCompletionBodySchema.parse(req.body);
      const quest = questService.setCompletion(questId, body.completed);
      res.json({ quest });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
