import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import type { Db } from './db/connection.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createQuestRepository } from './repositories/questRepository.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createAuthRouter } from './routes/auth.js';
import { createQuestsRouter } from './routes/quests.js';
import { createAuthService } from './services/authService.js';
import { createQuestService } from './services/questService.js';

export type CreateAppOptions = {
  db: Db;
  clock?: Clock;
};

export function createApp(options: CreateAppOptions) {
  const clock = options.clock ?? systemClock;
  const users = createUserRepository(options.db);
  const quests = createQuestRepository(options.db);
  const authService = createAuthService({ users });
  const questService = createQuestService({ quests, clock });

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', createAuthRouter(authService));
  app.use('/api/quests', createQuestsRouter(questService));

  app.use(errorHandler);
  return app;
}
