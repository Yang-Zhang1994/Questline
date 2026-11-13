import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEchoChatClient } from '../ai/client.js';
import { systemClock } from '../clock.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { DEMO_EMAIL, seedDemoDataIfEmpty } from '../db/seed.js';
import { createGoalRepository } from '../repositories/goalRepository.js';
import { createInterviewRepository } from '../repositories/interviewRepository.js';
import { createGoalService } from './goalService.js';

describe('goalService manual plan (Issue #21)', () => {
  let db: Db;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, systemClock);
  });

  afterAll(async () => {
    await db?.end();
  });

  async function demoUserId(): Promise<number> {
    const result = await db.query<{ id: number }>(
      `SELECT id FROM users WHERE email = $1`,
      [DEMO_EMAIL],
    );
    return result.rows[0].id;
  }

  function buildService() {
    return createGoalService({
      goals: createGoalRepository(db),
      interviews: createInterviewRepository(db),
      ai: createEchoChatClient(),
      clock: systemClock,
      restartInterview: vi.fn(async () => ({
        messages: [],
        interview: {
          status: 'in_progress' as const,
          current_topic: 'done_definition' as const,
          answered_topics: [] as [],
          answers: {
            done_definition: null,
            starting_point: null,
            time_budget: null,
            deadline: null,
          },
        },
      })),
    });
  }

  it('creates a manual goal with milestones and pauses the prior active goal', async () => {
    const service = buildService();
    const userId = await demoUserId();
    const before = await service.listGoals(userId);
    const previousActive = before.active_goal_id!;

    const result = await service.createManualPlan(userId, {
      title: 'Cook dinner twice a week',
      concrete_goal: 'Plate two home-cooked dinners every week by spring',
      deadline: '2027-03-01',
      milestones: ['Stock a tiny pantry', 'Learn three easy recipes', 'Cook on a schedule'],
    });

    expect(result.goal.title).toBe('Cook dinner twice a week');
    expect(result.goal.done_definition).toBe(
      'Plate two home-cooked dinners every week by spring',
    );
    expect(result.goal.deadline).toBe('2027-03-01');
    expect(result.goal.status).toBe('active');
    expect(result.milestones).toHaveLength(3);
    expect(result.milestones[0].status).toBe('current');
    expect(result.milestones[1].status).toBe('upcoming');

    const after = await service.listGoals(userId);
    expect(after.active_goal_id).toBe(result.goal.id);
    expect(after.goals.find((g) => g.id === previousActive)?.status).toBe('paused');
  });

  it('rejects a manual plan without a goal name or milestones', async () => {
    const service = buildService();
    const userId = await demoUserId();

    await expect(
      service.createManualPlan(userId, {
        title: '   ',
        concrete_goal: null,
        deadline: null,
        milestones: ['One stage'],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      service.createManualPlan(userId, {
        title: 'A goal',
        concrete_goal: null,
        deadline: null,
        milestones: [],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
