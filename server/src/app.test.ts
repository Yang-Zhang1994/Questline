import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as aiClientModule from './ai/client.js';
import type { ChatAiClient } from './ai/client.js';
import { createApp } from './app.js';
import type { Clock } from './clock.js';
import { openDatabase, resetDatabase, type Db } from './db/connection.js';

vi.mock('./ai/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ai/client.js')>();
  return {
    ...actual,
    createClaudeClient: vi.fn((options?: aiClientModule.CreateClaudeClientOptions) =>
      actual.createClaudeClient(options),
    ),
  };
});

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

describe('createApp default lazy AI proxy', () => {
  let db: Db;
  const clock = fixedClock('2026-11-10T15:00:00.000Z');

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await db?.end();
  });

  it('lazily initializes createClaudeClient and forwards every method of ChatAiClient', async () => {
    const echo = aiClientModule.createEchoChatClient();
    const productionClient = aiClientModule.createClaudeClient({
      apiKey: 'test-key-no-network',
      model: 'claude-test-model',
    });
    vi.clearAllMocks();

    const spyClient: Required<ChatAiClient> = {
      completeChat: vi.fn((messages) => echo.completeChat(messages)),
      evaluateInterviewAnswer: vi.fn((input) => echo.evaluateInterviewAnswer(input)),
      proposeGoalDraft: vi.fn((input) => echo.proposeGoalDraft(input)),
      reviseGoalDraft: vi.fn((input) => echo.reviseGoalDraft(input)),
      proposeMilestones: vi.fn(async (input) => {
        if (!echo.proposeMilestones) {
          throw new Error('missing proposeMilestones on echo client');
        }
        return echo.proposeMilestones(input);
      }),
      generateDailyQuests: vi.fn(async (input) => {
        if (!echo.generateDailyQuests) {
          throw new Error('missing generateDailyQuests on echo client');
        }
        return echo.generateDailyQuests(input);
      }),
      proposeWeekPlan: vi.fn(async (input) => {
        if (!echo.proposeWeekPlan) {
          throw new Error('missing proposeWeekPlan on echo client');
        }
        return echo.proposeWeekPlan(input);
      }),
      proposeReschedule: vi.fn(async (input) => {
        if (!echo.proposeReschedule) {
          throw new Error('missing proposeReschedule on echo client');
        }
        const base = await echo.proposeReschedule(input);
        return {
          ...base,
          mochi_message: 'Forwarded via lazy AI proxy ♡',
        };
      }),
    };

    const methodNames = Object.keys(productionClient) as Array<keyof Required<ChatAiClient>>;
    expect([...methodNames].sort()).toEqual(Object.keys(echo).sort());
    expect([...methodNames].sort()).toEqual(Object.keys(spyClient).sort());

    vi.mocked(aiClientModule.createClaudeClient).mockReturnValue(spyClient);

    // Build the app through the default createApp path (no injected `ai` option).
    const app = createApp({ db, clock });

    // Lazy proxy must not instantiate the AI client before an AI-backed route runs.
    await request(app).get('/api/health').expect(200);
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'proxy-check@questline.local', password: 'password-12345' })
      .expect(201);
    const token = registerRes.body.token as string;
    const authHeader = `Bearer ${token}`;

    expect(aiClientModule.createClaudeClient).not.toHaveBeenCalled();

    // 1. evaluateInterviewAnswer (interview in progress on topic 1: done_definition)
    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', authHeader)
      .send({ content: 'Finish reading one short Japanese novel from cover to cover' })
      .expect(201);
    expect(spyClient.evaluateInterviewAnswer).toHaveBeenCalledTimes(1);
    expect(aiClientModule.createClaudeClient).toHaveBeenCalledTimes(1);

    // Complete remaining interview topics so we can exercise goal draft / chat / milestone / quest routes.
    await db.query(
      `UPDATE goal_interviews
       SET status = 'complete',
           current_topic = 'deadline',
           done_definition = 'Finish reading one short Japanese novel from cover to cover',
           starting_point = 'I know hiragana and basic vocabulary',
           time_budget = '30 minutes per day',
           deadline = '2027-03-01'
       WHERE user_id = 1`,
    );

    // 2. proposeGoalDraft
    await request(app)
      .post('/api/goals/draft')
      .set('Authorization', authHeader)
      .send({})
      .expect(201);
    expect(spyClient.proposeGoalDraft).toHaveBeenCalledTimes(1);

    // 3. reviseGoalDraft
    const reviseRes = await request(app)
      .post('/api/goals/draft/revise')
      .set('Authorization', authHeader)
      .send({ feedback: 'Keep daily sessions gentle at 30 minutes' })
      .expect(200);
    expect(spyClient.reviseGoalDraft).toHaveBeenCalledTimes(1);

    // 4. completeChat (interview status is 'complete')
    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', authHeader)
      .send({ content: 'Thank you Mochi, I am excited to start!' })
      .expect(201);
    expect(spyClient.completeChat).toHaveBeenCalledTimes(1);

    // Confirm the goal draft so the user has an active goal.
    await request(app)
      .post('/api/goals/confirm')
      .set('Authorization', authHeader)
      .send({ draft: reviseRes.body.draft })
      .expect(201);

    // 5. proposeMilestones
    const milestonesProposeRes = await request(app)
      .post('/api/milestones/propose')
      .set('Authorization', authHeader)
      .send({})
      .expect(200);
    expect(spyClient.proposeMilestones).toHaveBeenCalledTimes(1);

    // Confirm milestones so the user has a `current` milestone.
    await request(app)
      .post('/api/milestones/confirm')
      .set('Authorization', authHeader)
      .send({ milestones: milestonesProposeRes.body.milestones })
      .expect(201);

    // 6. generateDailyQuests
    await request(app)
      .post('/api/quests/generate')
      .set('Authorization', authHeader)
      .send({ local_date: '2026-11-10' })
      .expect(200);
    expect(spyClient.generateDailyQuests).toHaveBeenCalledTimes(1);

    // Clear generated quests so the 30m/day window has capacity for week-plan and reschedule proposals.
    await db.query(`DELETE FROM quests`);

    // 7. proposeWeekPlan
    await request(app)
      .post('/api/quests/week-plan/propose')
      .set('Authorization', authHeader)
      .send({ local_date: '2026-11-10' })
      .expect(200);
    expect(spyClient.proposeWeekPlan).toHaveBeenCalledTimes(1);

    // Seed an incomplete earlier quest on the current milestone so reschedule has work to move.
    await db.query(
      `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at)
       VALUES (1, 'Earlier reading warmup', '2026-11-08', 15, NULL)`,
    );

    // 8. proposeReschedule
    const rescheduleRes = await request(app)
      .post('/api/quests/reschedule/propose')
      .set('Authorization', authHeader)
      .send({ local_date: '2026-11-10' })
      .expect(200);
    expect(spyClient.proposeReschedule).toHaveBeenCalledTimes(1);
    expect(rescheduleRes.body.mochi_message.content).toBe('Forwarded via lazy AI proxy ♡');

    // Every method of ChatAiClient must have been forwarded through the single cached client.
    expect(aiClientModule.createClaudeClient).toHaveBeenCalledTimes(1);
    for (const method of methodNames) {
      expect(
        spyClient[method],
        `Expected default createApp() lazy AI proxy to forward ChatAiClient.${method}`,
      ).toHaveBeenCalledTimes(1);
    }
  });
});
