import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { IsoDateSchema, UpsertDiaryNoteBodySchema } from '@questline/shared';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { DiaryNoteService } from '../services/diaryNoteService.js';
import { unauthorized, validationError } from '../services/errors.js';

const diaryWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Too many diary saves — take a soft breath and try again in a minute.',
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

export function createDiaryNotesRouter(diaryNoteService: DiaryNoteService): Router {
  const router = Router();

  router.use(requireAuth);

  /** Load today's diary note for the active goal (empty content when none yet). */
  router.get('/', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const localDate = parseOptionalLocalDate(req.query.local_date);
      const payload = await diaryNoteService.getTodayNote(user.id, localDate);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Autosave upsert — one note per active goal per local calendar day (#19). */
  router.put('/', diaryWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) throw unauthorized();
      const body = UpsertDiaryNoteBodySchema.parse(req.body ?? {});
      const payload = await diaryNoteService.upsertTodayNote(
        user.id,
        body.content,
        body.local_date,
      );
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
