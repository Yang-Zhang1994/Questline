import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createEchoChatClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { seedDemoDataIfEmpty } from '../db/seed.js';
import { createMilestoneRepository } from '../repositories/milestoneRepository.js';
import { createProgressRepository } from '../repositories/progressRepository.js';
import { createQuestRepository } from '../repositories/questRepository.js';
import { AppError } from './errors.js';
import { createMilestoneAdvanceService } from './milestoneAdvanceService.js';
import { createQuestService } from './questService.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

describe('milestoneAdvanceService (Issue #10)', () => {
  let db: Db;
  let demoUserId: number;
  const iso = '2026-11-10T15:00:00.000Z';
  const clock = fixedClock(iso);

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, clock);
    const user = await db.query<{ id: number }>(
      `SELECT id FROM users WHERE email = 'demo@questline.local'`,
    );
    demoUserId = user.rows[0].id;
  });

  afterAll(async () => {
    await db?.end();
  });

  async function currentMilestoneId(): Promise<number> {
    const result = await db.query<{ id: number }>(
      `SELECT m.id FROM milestones m
       INNER JOIN goals g ON g.id = m.goal_id
       WHERE g.user_id = $1 AND m.status = 'current'
       LIMIT 1`,
      [demoUserId],
    );
    return result.rows[0].id;
  }

  async function addUpcomingMilestone(title: string, position: number): Promise<number> {
    const goal = await db.query<{ id: number }>(
      `SELECT id FROM goals WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [demoUserId],
    );
    const inserted = await db.query<{ id: number }>(
      `INSERT INTO milestones (goal_id, position, title, description, target_date, status)
       VALUES ($1, $2, $3, $4, $5, 'upcoming')
       RETURNING id`,
      [goal.rows[0].id, position, title, `${title} description`, '2027-03-01'],
    );
    return inserted.rows[0].id;
  }

  async function completeAllCurrentQuests() {
    const mid = await currentMilestoneId();
    await db.query(
      `UPDATE quests SET completed_at = $1 WHERE milestone_id = $2 AND completed_at IS NULL`,
      [iso, mid],
    );
  }

  // AC: Completing a stage moves the roadmap highlight to the next milestone
  it('advances current → completed and next → current', async () => {
    const nextId = await addUpcomingMilestone('Finish a graded reader', 2);
    const currentId = await currentMilestoneId();
    await completeAllCurrentQuests();

    const milestones = createMilestoneRepository(db);
    const service = createMilestoneAdvanceService({ milestones });
    const result = await service.completeStage(demoUserId, currentId);

    expect(result.goal_completed).toBe(false);
    expect(result.completed_milestone.id).toBe(currentId);
    expect(result.completed_milestone.status).toBe('completed');
    expect(result.next_milestone?.id).toBe(nextId);
    expect(result.next_milestone?.status).toBe('current');
    expect(result.milestones.map((m) => m.status)).toEqual(['completed', 'current']);
    expect(result.mochi_message).toMatch(/Stage cleared/i);
  });

  // AC: Completing the final milestone shows a goal-complete celebration
  it('completes the goal when the final stage clears', async () => {
    const currentId = await currentMilestoneId();
    await completeAllCurrentQuests();

    const milestones = createMilestoneRepository(db);
    const service = createMilestoneAdvanceService({ milestones });
    const result = await service.completeStage(demoUserId, currentId);

    expect(result.goal_completed).toBe(true);
    expect(result.next_milestone).toBeNull();
    expect(result.goal.status).toBe('completed');
    expect(result.mochi_message).toMatch(/You did it/i);
  });

  it('rejects incomplete stages and leaves XP untouched', async () => {
    const currentId = await currentMilestoneId();
    const progressBefore = await createProgressRepository(db).getOrCreate(demoUserId);

    const milestones = createMilestoneRepository(db);
    const service = createMilestoneAdvanceService({ milestones });
    await expect(service.completeStage(demoUserId, currentId)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    } satisfies Partial<AppError>);

    const progressAfter = await createProgressRepository(db).getOrCreate(demoUserId);
    expect(progressAfter.xp).toBe(progressBefore.xp);
  });

  it('marks stage_ready on quest GET after all current-stage quests are done', async () => {
    await completeAllCurrentQuests();
    const questService = createQuestService({
      quests: createQuestRepository(db),
      progress: createProgressRepository(db),
      ai: createEchoChatClient(),
      clock,
    });
    const payload = await questService.getCurrentMilestoneQuests(demoUserId, '2026-11-10');
    expect(payload.stage_ready).toBe(true);
    expect(payload.stage_ready_milestone?.milestone_id).toBe(await currentMilestoneId());
  });
});
