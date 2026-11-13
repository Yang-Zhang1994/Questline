import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createClaudeClient, type ChatAiClient } from './ai/client.js';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import type { Db } from './db/connection.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createChatRepository } from './repositories/chatRepository.js';
import { createGoalRepository } from './repositories/goalRepository.js';
import { createInterviewRepository } from './repositories/interviewRepository.js';
import { createMilestoneRepository } from './repositories/milestoneRepository.js';
import { createProgressRepository } from './repositories/progressRepository.js';
import { createQuestRepository } from './repositories/questRepository.js';
import { createRoadmapRepository } from './repositories/roadmapRepository.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createAuthRouter } from './routes/auth.js';
import { createChatRouter } from './routes/chat.js';
import { createGoalsRouter } from './routes/goals.js';
import { createMilestonesRouter } from './routes/milestones.js';
import { createQuestsRouter } from './routes/quests.js';
import { createRoadmapRouter } from './routes/roadmap.js';
import { createAuthService } from './services/authService.js';
import { createChatService } from './services/chatService.js';
import { createGoalService } from './services/goalService.js';
import { createMilestoneAdvanceService } from './services/milestoneAdvanceService.js';
import { createMilestoneService } from './services/milestoneService.js';
import { createQuestService } from './services/questService.js';
import { createRoadmapService } from './services/roadmapService.js';

export type CreateAppOptions = {
  db: Db;
  clock?: Clock;
  /** Inject a fake in tests — never hit the real Claude API. */
  ai?: ChatAiClient;
};

export function createApp(options: CreateAppOptions) {
  const clock = options.clock ?? systemClock;
  const users = createUserRepository(options.db);
  const chat = createChatRepository(options.db);
  const interviews = createInterviewRepository(options.db);
  const milestones = createMilestoneRepository(options.db);
  const quests = createQuestRepository(options.db);
  const progress = createProgressRepository(options.db);
  const roadmap = createRoadmapRepository(options.db);
  const goals = createGoalRepository(options.db);
  const authService = createAuthService({ users });
  const roadmapService = createRoadmapService({ roadmap });

  // Lazy default so auth/chat tests can createApp without ANTHROPIC_* env.
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
        async proposeGoalDraft(input) {
          cached ??= createClaudeClient();
          return cached.proposeGoalDraft(input);
        },
        async reviseGoalDraft(input) {
          cached ??= createClaudeClient();
          return cached.reviseGoalDraft(input);
        },
        async proposeMilestones(input) {
          cached ??= createClaudeClient();
          if (!cached.proposeMilestones) {
            throw new Error('Milestone proposal is not configured on AI client');
          }
          return cached.proposeMilestones(input);
        },
        async generateDailyQuests(input) {
          cached ??= createClaudeClient();
          if (!cached.generateDailyQuests) {
            throw new Error('Daily quest generation is not configured on AI client');
          }
          return cached.generateDailyQuests(input);
        },
      };
    })();
  const chatService = createChatService({ chat, interviews, ai, clock });
  const goalService = createGoalService({
    goals,
    interviews,
    ai,
    clock,
    restartInterview: (userId) => chatService.restartInterview(userId),
  });
  const milestoneService = createMilestoneService({ milestones, chat, ai, clock });
  const milestoneAdvanceService = createMilestoneAdvanceService({ milestones });
  const questService = createQuestService({ quests, progress, ai, clock });

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
  app.use('/api/milestones', createMilestonesRouter(milestoneService, milestoneAdvanceService));
  app.use('/api/roadmap', createRoadmapRouter(roadmapService));
  app.use('/api/goals', createGoalsRouter(goalService));

  app.use(errorHandler);
  return app;
}
