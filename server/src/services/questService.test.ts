import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '../clock.js';
import { XP_PER_QUEST, XP_TO_REACH_LEVEL } from '../config/game.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { seedDemoDataIfEmpty } from '../db/seed.js';
import { createProgressRepository } from '../repositories/progressRepository.js';
import { createQuestRepository } from '../repositories/questRepository.js';
import { createQuestService } from './questService.js';
import { AppError } from './errors.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

describe('questService (Issue #9 / #11 / #17 / #31 Postgres)', () => {
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

  function service() {
    const quests = createQuestRepository(db);
    const progress = createProgressRepository(db);
    return { quests, progress, service: createQuestService({ quests, progress, clock }) };
  }

  // AC: User can mark a quest as done from the daily note
  it('marks a quest completed and returns completed_at', async () => {
    const { service: questService } = service();
    const today = await questService.getToday(demoUserId);
    const quest = today.quests[0];
    expect(quest).toBeDefined();
    expect(quest.completed_at).toBeNull();

    const updated = await questService.setCompletion(demoUserId, quest.id, true);
    expect(updated.quest.completed_at).toBe('2026-10-28T15:30:00Z');
  });

  // AC: User can undo an accidental check-off
  it('clears completed_at when undoing a check-off', async () => {
    const { service: questService } = service();
    const quest = (await questService.getToday(demoUserId)).quests[0];
    await questService.setCompletion(demoUserId, quest.id, true);
    const undone = await questService.setCompletion(demoUserId, quest.id, false);
    expect(undone.quest.completed_at).toBeNull();
  });

  // AC: Completing a quest awards XP
  it('awards XP_PER_QUEST when completing a quest', async () => {
    const { service: questService } = service();
    const quest = (await questService.getToday(demoUserId)).quests[0];
    const before = await questService.getToday(demoUserId);
    expect(before.progress.xp).toBe(0);
    expect(before.progress.level).toBe(1);

    const updated = await questService.setCompletion(demoUserId, quest.id, true);
    expect(updated.progress.xp).toBe(XP_PER_QUEST);
    expect(updated.leveled_up).toBe(false);
  });

  // AC: Undoing a check-off removes the XP that quest awarded
  it('removes awarded XP when undoing a check-off', async () => {
    const { service: questService } = service();
    const quest = (await questService.getToday(demoUserId)).quests[0];
    await questService.setCompletion(demoUserId, quest.id, true);
    const undone = await questService.setCompletion(demoUserId, quest.id, false);
    expect(undone.progress.xp).toBe(0);
    expect(undone.quest.completed_at).toBeNull();
  });

  // AC: Leveling up shows a short celebration message from Mochi
  it('levels up and returns a Mochi celebration when XP crosses a threshold', async () => {
    const { service: questService } = service();
    // Seed XP just below level 2 (50).
    await db.query(`UPDATE user_progress SET xp = $1, level = 1 WHERE user_id = $2`, [
      XP_TO_REACH_LEVEL[2] - XP_PER_QUEST,
      demoUserId,
    ]);
    const quest = (await questService.getToday(demoUserId)).quests[0];
    const updated = await questService.setCompletion(demoUserId, quest.id, true);
    expect(updated.progress.level).toBe(2);
    expect(updated.leveled_up).toBe(true);
    expect(updated.level_up_message).toMatch(/Level 2/);
    expect(updated.level_up_message).toMatch(/Mochi/i);
  });

  it('does not double-award XP on an already-completed quest', async () => {
    const { service: questService } = service();
    const quest = (await questService.getToday(demoUserId)).quests[0];
    await questService.setCompletion(demoUserId, quest.id, true);
    const again = await questService.setCompletion(demoUserId, quest.id, true);
    expect(again.progress.xp).toBe(XP_PER_QUEST);
    expect(again.leveled_up).toBe(false);
  });

  // AC: Completion status and completion time are saved
  it('persists completion status and timestamp via the repository', async () => {
    const { service: questService, quests } = service();
    const quest = (await questService.getToday(demoUserId)).quests[1];
    await questService.setCompletion(demoUserId, quest.id, true);
    const stored = await quests.findByIdForUser(demoUserId, quest.id);
    expect(stored?.completed_at).toBe('2026-10-28T15:30:00Z');
  });

  // AC: Completed quests stay completed after a page reload
  it('keeps completed quests completed when today is fetched again', async () => {
    const { service: questService } = service();
    const quest = (await questService.getToday(demoUserId)).quests[0];
    await questService.setCompletion(demoUserId, quest.id, true);

    const reloaded = await questService.getToday(demoUserId);
    const found = reloaded.quests.find((q) => q.id === quest.id);
    expect(found?.completed_at).toBe('2026-10-28T15:30:00Z');
    expect(reloaded.done_count).toBe(1);
    expect(reloaded.progress.xp).toBe(XP_PER_QUEST);
  });

  it('throws NOT_FOUND for unknown quest ids', async () => {
    const { service: questService } = service();
    await expect(questService.setCompletion(demoUserId, 9999, true)).rejects.toThrow(AppError);
  });

  it('scopes today quests to the given user id', async () => {
    const { service: questService } = service();
    const empty = await questService.getToday(999_999);
    expect(empty.quests).toEqual([]);
    expect(empty.total_count).toBe(0);
    expect(empty.progress.level).toBe(1);
  });
});
