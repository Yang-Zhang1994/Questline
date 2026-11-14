import { IsoDateSchema, UpsertDiaryNoteBodySchema } from '@questline/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { DiaryService } from '../services/diaryService.js';
import { unauthorized } from '../services/errors.js';

const LocalDateQuerySchema = z.object({
  local_date: IsoDateSchema.optional(),
});

const diarySaveLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Too many diary saves — take a soft breath and try again in a minute.',
    },
  },
});

export function createDiaryNotesRouter(diaryService: DiaryService): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const { local_date: localDate } = LocalDateQuerySchema.parse(req.query);
      const payload = await diaryService.getTodayNote(user.id, localDate);
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.put('/', diarySaveLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const body = UpsertDiaryNoteBodySchema.parse(req.body ?? {});
      const payload = await diaryService.upsertTodayNote(user.id, body.content, body.local_date);
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
