import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createClaudeClient, type ChatAiClient } from './ai/client.js';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import type { Db } from './db/connection.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createChatRepository } from './repositories/chatRepository.js';
import { createInterviewRepository } from './repositories/interviewRepository.js';
import { createMilestoneRepository } from './repositories/milestoneRepository.js';
import { createQuestRepository } from './repositories/questRepository.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createAuthRouter } from './routes/auth.js';
import { createChatRouter } from './routes/chat.js';
import { createMilestonesRouter } from './routes/milestones.js';
import { createQuestsRouter } from './routes/quests.js';
import { createAuthService } from './services/authService.js';
import { createChatService } from './services/chatService.js';
import { createMilestonePlanService } from './services/milestonePlanService.js';
import { createQuestService } from './services/questService.js';

export type CreateAppOptions = {
  db: Db;
  clock?: Clock;
  /** Inject a fake in tests — never hit the real Claude API. */
  ai?: ChatAiClient;
};

export function createApp(options: CreateAppOptions) {
  const clock = options.clock ?? systemClock;
  const users = createUserRepository(options.db);
  const quests = createQuestRepository(options.db);
  const chat = createChatRepository(options.db);
  const interviews = createInterviewRepository(options.db);
  const milestones = createMilestoneRepository(options.db);
  const authService = createAuthService({ users });
  const questService = createQuestService({ quests, clock });
  // Lazy default so quest/auth tests can createApp without ANTHROPIC_* env.
  const ai: ChatAiClient =
    options.ai ??
    (() => {
      let cached: ChatAiClient | null = null;
      return {
        async completeChat(messages) {
          cached ??= createClaudeClient();
          return cached.completeChat(messages);
        },
        async evaluateInterviewAnswer(input) {
          cached ??= createClaudeClient();
          return cached.evaluateInterviewAnswer(input);
        },
        async proposeMilestonePlan(input) {
          cached ??= createClaudeClient();
          return cached.proposeMilestonePlan(input);
        },
        async reviseMilestonePlan(input) {
          cached ??= createClaudeClient();
          return cached.reviseMilestonePlan(input);
        },
      };
    })();
  const chatService = createChatService({ chat, interviews, ai, clock });
  const milestonePlanService = createMilestonePlanService({ milestones, ai, clock });

  const app = express();
  // express-rate-limit needs a stable IP behind proxies / Vitest.
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', createAuthRouter(authService));
  app.use('/api/quests', createQuestsRouter(questService));
  app.use('/api/chat', createChatRouter(chatService));
  app.use('/api/milestones', createMilestonesRouter(milestonePlanService));

  app.use(errorHandler);
  return app;
}
