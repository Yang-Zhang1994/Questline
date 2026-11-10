import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '../clock.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { seedDemoDataIfEmpty } from '../db/seed.js';
import { createMilestoneRepository } from '../repositories/milestoneRepository.js';
import { createQuestRepository } from '../repositories/questRepository.js';
import { createProgressRepository } from '../repositories/progressRepository.js';
import { createStampRepository } from '../repositories/stampRepository.js';
import { createMilestoneAdvanceService } from './milestoneAdvanceService.js';
import { createQuestService } from './questService.js';
import { AppError } from './errors.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

describe('milestoneAdvanceService (Issue #10)', () => {
  let db: Db;
  let demoUserId: number;
  const iso = '2026-10-28T15:30:00.000Z';
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
    const quests = createQuestRepository(db);
    const progress = createProgressRepository(db);
    const stamps = createStampRepository(db);
    const questService = createQuestService({ quests, progress, stamps, clock });
    const today = await questService.getToday(demoUserId);
    for (const quest of today.quests) {
      if (quest.completed_at == null) {
        await questService.setCompletion(demoUserId, quest.id, true);
      }
    }
    // Also complete any non-today quests on the current milestone.
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
    expect(result.mochi_message).not.toMatch(/should have|lazy|behind|guilt/i);
  });

  // AC: Completing the final milestone shows a goal-complete celebration payload
  it('completes the goal when the final milestone clears', async () => {
    const currentId = await currentMilestoneId();
    await completeAllCurrentQuests();

    const milestones = createMilestoneRepository(db);
    const service = createMilestoneAdvanceService({ milestones });
    const result = await service.completeStage(demoUserId, currentId);

    expect(result.goal_completed).toBe(true);
    expect(result.next_milestone).toBeNull();
    expect(result.completed_milestone.status).toBe('completed');
    expect(result.mochi_message).toMatch(/You did it/i);
    expect(result.mochi_message).toMatch(/Mochi/i);

    const goal = await db.query<{ status: string }>(
      `SELECT status FROM goals WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
      [demoUserId],
    );
    expect(goal.rows[0].status).toBe('completed');
  });

  // AC: After advancing, quests for the new stage can be generated (empty current)
  it('leaves the new current stage without quests so generation can run', async () => {
    await addUpcomingMilestone('Finish a graded reader', 2);
    const currentId = await currentMilestoneId();
    await completeAllCurrentQuests();

    const milestones = createMilestoneRepository(db);
    const service = createMilestoneAdvanceService({ milestones });
    const result = await service.completeStage(demoUserId, currentId);

    const quests = createQuestRepository(db);
    const ctx = await quests.findCurrentMilestoneQuestContext(demoUserId);
    expect(ctx?.milestone.id).toBe(result.next_milestone?.id);
    expect(ctx?.quests).toEqual([]);
  });

  it('rejects completing a stage with incomplete quests', async () => {
    const currentId = await currentMilestoneId();
    const milestones = createMilestoneRepository(db);
    const service = createMilestoneAdvanceService({ milestones });

    await expect(service.completeStage(demoUserId, currentId)).rejects.toBeInstanceOf(AppError);
    await expect(service.completeStage(demoUserId, currentId)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('does not disturb XP when advancing (rewards stay on quest completion)', async () => {
    await addUpcomingMilestone('Finish a graded reader', 2);
    const currentId = await currentMilestoneId();
    await completeAllCurrentQuests();

    const before = await db.query<{ xp: number }>(
      `SELECT xp FROM user_progress WHERE user_id = $1`,
      [demoUserId],
    );

    const milestones = createMilestoneRepository(db);
    const service = createMilestoneAdvanceService({ milestones });
    await service.completeStage(demoUserId, currentId);

    const after = await db.query<{ xp: number }>(
      `SELECT xp FROM user_progress WHERE user_id = $1`,
      [demoUserId],
    );
    expect(after.rows[0].xp).toBe(before.rows[0].xp);
    expect(after.rows[0].xp).toBeGreaterThan(0);
  });
});
