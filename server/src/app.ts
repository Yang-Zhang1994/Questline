import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import type { Db } from './db/connection.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createQuestRepository } from './repositories/questRepository.js';
import { createQuestsRouter } from './routes/quests.js';
import { createQuestService } from './services/questService.js';

export type CreateAppOptions = {
  db: Db;
  clock?: Clock;
};

export function createApp(options: CreateAppOptions) {
  const clock = options.clock ?? systemClock;
  const quests = createQuestRepository(options.db);
  const questService = createQuestService({ quests, clock });

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/quests', createQuestsRouter(questService));

  app.use(errorHandler);
  return app;
}
