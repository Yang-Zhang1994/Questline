import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { DEMO_EMAIL, DEMO_TITLES, seedDemoDataIfEmpty } from '../db/seed.js';
import { createGoalRepository } from '../repositories/goalRepository.js';
import { createGoalService } from './goalService.js';
import { systemClock } from '../clock.js';
import { createEchoChatClient } from '../ai/client.js';
import { createInterviewRepository } from '../repositories/interviewRepository.js';

describe('goalService multi-goal (Issue #18)', () => {
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

  function buildService(
    restart = vi.fn(async () => ({
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
  ) {
    const goals = createGoalRepository(db);
    const interviews = createInterviewRepository(db);
    const service = createGoalService({
      goals,
      interviews,
      ai: createEchoChatClient(),
      clock: systemClock,
      restartInterview: restart,
    });
    return { service, restart };
  }

  it('lists selectable goals with the active id', async () => {
    const { service } = buildService();
    const userId = await demoUserId();
    const listed = await service.listGoals(userId);

    expect(listed.goals).toHaveLength(2);
    expect(listed.goals.map((g) => g.title).sort()).toEqual(
      [DEMO_TITLES.goal, DEMO_TITLES.pausedGoal].sort(),
    );
    const active = listed.goals.find((g) => g.status === 'active');
    expect(active?.title).toBe(DEMO_TITLES.goal);
    expect(listed.active_goal_id).toBe(active?.id ?? null);
  });

  it('activates a paused goal and pauses the previous active one', async () => {
    const { service } = buildService();
    const userId = await demoUserId();
    const listed = await service.listGoals(userId);
    const paused = listed.goals.find((g) => g.status === 'paused');
    expect(paused).toBeTruthy();

    const result = await service.activateGoal(userId, paused!.id);
    expect(result.goal.id).toBe(paused!.id);
    expect(result.goal.status).toBe('active');
    expect(result.active_goal_id).toBe(paused!.id);

    const after = await service.listGoals(userId);
    expect(after.goals.filter((g) => g.status === 'active')).toHaveLength(1);
    expect(after.goals.find((g) => g.title === DEMO_TITLES.goal)?.status).toBe('paused');
    expect(after.goals.find((g) => g.title === DEMO_TITLES.pausedGoal)?.status).toBe('active');
  });

  it('pauses the active goal and restarts the interview for a new goal', async () => {
    const { service, restart } = buildService();
    const userId = await demoUserId();
    const before = await service.listGoals(userId);
    const previousActive = before.active_goal_id;

    const result = await service.startNewGoal(userId);
    expect(restart).toHaveBeenCalledWith(userId);
    expect(result.paused_goal_id).toBe(previousActive);
    expect(result.active_goal_id).toBeNull();
    expect(result.goals.every((g) => g.status !== 'active')).toBe(true);
    expect(result.goals.some((g) => g.id === previousActive && g.status === 'paused')).toBe(true);
  });

  it('deletes a goal and cascades milestones + quests', async () => {
    const { service } = buildService();
    const userId = await demoUserId();
    const listed = await service.listGoals(userId);
    const active = listed.goals.find((g) => g.status === 'active')!;
    const paused = listed.goals.find((g) => g.status === 'paused')!;

    const questCountBefore = await db.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM quests q
       INNER JOIN milestones m ON m.id = q.milestone_id
       WHERE m.goal_id = $1`,
      [active.id],
    );
    expect(Number(questCountBefore.rows[0].c)).toBeGreaterThan(0);

    const result = await service.deleteGoal(userId, active.id);
    expect(result.deleted_goal_id).toBe(active.id);
    expect(result.active_goal_id).toBe(paused.id);

    const gone = await db.query(`SELECT id FROM goals WHERE id = $1`, [active.id]);
    expect(gone.rowCount).toBe(0);
    const milestones = await db.query(`SELECT id FROM milestones WHERE goal_id = $1`, [
      active.id,
    ]);
    expect(milestones.rowCount).toBe(0);
  });

  it('rejects activating an unknown goal', async () => {
    const { service } = buildService();
    const userId = await demoUserId();
    await expect(service.activateGoal(userId, 999_999)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
