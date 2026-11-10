import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '../clock.js';
import { STAMPS_PER_CARD, XP_PER_QUEST, XP_TO_REACH_LEVEL } from '../config/game.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { seedDemoDataIfEmpty } from '../db/seed.js';
import { createProgressRepository } from '../repositories/progressRepository.js';
import { createQuestRepository } from '../repositories/questRepository.js';
import { createStampRepository } from '../repositories/stampRepository.js';
import { createQuestService } from './questService.js';
import { AppError } from './errors.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

describe('questService (Issue #9 / #11 / #12 / #13 / #17 / #31 Postgres)', () => {
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
    const stamps = createStampRepository(db);
    return {
      quests,
      progress,
      stamps,
      service: createQuestService({ quests, progress, stamps, clock }),
    };
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

  // AC (#10): When all quests for the current milestone are done, stage_ready prompts completion
  it('sets stage_ready after the last current-milestone quest is completed', async () => {
    const { service: questService } = service();
    const today = await questService.getToday(demoUserId);
    expect(today.stage_ready).toBe(false);

    let last = null as Awaited<ReturnType<typeof questService.setCompletion>> | null;
    for (const quest of today.quests) {
      last = await questService.setCompletion(demoUserId, quest.id, true);
    }
    expect(last?.stage_ready).toBe(true);
    expect(last?.stage_ready_milestone?.milestone_title).toMatch(/daily reading habit/i);
    // XP / stamp path still intact alongside stage detection.
    expect(last?.progress.xp).toBe(XP_PER_QUEST * today.quests.length);
    expect(last?.stamp_card.filled_count).toBeGreaterThan(0);
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

  // AC: The streak increases by 1 on each day the user completes at least one quest
  // AC: Completing several quests on the same day counts as one streak day
  it('bumps current streak once per local active day', async () => {
    const { service: questService } = service();
    const today = await questService.getToday(demoUserId, '2026-10-28');
    const [first, second] = today.quests;
    expect(today.progress.current_streak).toBe(0);

    const one = await questService.setCompletion(demoUserId, first.id, true, '2026-10-28');
    expect(one.progress.current_streak).toBe(1);
    expect(one.progress.best_streak).toBe(1);
    expect(one.progress.last_active_date).toBe('2026-10-28');

    const two = await questService.setCompletion(demoUserId, second.id, true, '2026-10-28');
    expect(two.progress.current_streak).toBe(1);
    expect(two.progress.best_streak).toBe(1);

    // Undo one of two same-day completions — streak day still stands.
    const partialUndo = await questService.setCompletion(
      demoUserId,
      second.id,
      false,
      '2026-10-28',
    );
    expect(partialUndo.progress.current_streak).toBe(1);
    expect(partialUndo.progress.last_active_date).toBe('2026-10-28');
  });

  // AC: Undoing reverses streak side effects when it was the only completion that day
  it('reverses streak when undoing the only completion of the local day', async () => {
    const { service: questService } = service();
    const quest = (await questService.getToday(demoUserId, '2026-10-28')).quests[0];
    await questService.setCompletion(demoUserId, quest.id, true, '2026-10-28');
    const undone = await questService.setCompletion(demoUserId, quest.id, false, '2026-10-28');
    expect(undone.progress.current_streak).toBe(0);
    expect(undone.progress.best_streak).toBe(0);
    expect(undone.progress.last_active_date).toBeNull();
  });

  // AC: The streak resets to 0 after a full day with no completed quest
  // AC: Streak logic uses the user's local date
  it('resets current streak after a missed local day and continues from yesterday', async () => {
    const { service: questService } = service();
    const quest = (await questService.getToday(demoUserId, '2026-10-28')).quests[0];
    await questService.setCompletion(demoUserId, quest.id, true, '2026-10-26');

    const afterMiss = await questService.getToday(demoUserId, '2026-10-28');
    expect(afterMiss.progress.current_streak).toBe(0);
    expect(afterMiss.progress.best_streak).toBe(1);

    await db.query(
      `UPDATE user_progress
       SET current_streak = 2, best_streak = 4, last_active_date = '2026-10-27',
           active_day_completions = 1
       WHERE user_id = $1`,
      [demoUserId],
    );
    const next = await questService.setCompletion(
      demoUserId,
      (await questService.getToday(demoUserId, '2026-10-28')).quests[1].id,
      true,
      '2026-10-28',
    );
    expect(next.progress.current_streak).toBe(3);
    expect(next.progress.best_streak).toBe(4);
    expect(next.progress.last_active_date).toBe('2026-10-28');
  });

  // AC: Each day with at least one completed quest earns one stamp
  // AC: Completing several quests on the same day still earns only one stamp
  it('earns one stamp per local active day', async () => {
    const { service: questService } = service();
    const today = await questService.getToday(demoUserId, '2026-10-28');
    expect(today.stamp_card.filled_count).toBe(0);
    expect(today.stamp_card.stamps_per_card).toBe(STAMPS_PER_CARD);

    const [first, second] = today.quests;
    const one = await questService.setCompletion(demoUserId, first.id, true, '2026-10-28');
    expect(one.stamp_card.filled_count).toBe(1);
    expect(one.stamp_card.stamped_dates).toEqual(['2026-10-28']);
    expect(one.card_completed).toBe(false);

    const two = await questService.setCompletion(demoUserId, second.id, true, '2026-10-28');
    expect(two.stamp_card.filled_count).toBe(1);
    expect(two.stamp_card.stamped_dates).toEqual(['2026-10-28']);
  });

  // AC: Undoing the only completed quest of a day removes that day's stamp
  it('removes the stamp when undoing the only completion of the local day', async () => {
    const { service: questService } = service();
    const quest = (await questService.getToday(demoUserId, '2026-10-28')).quests[0];
    await questService.setCompletion(demoUserId, quest.id, true, '2026-10-28');
    const undone = await questService.setCompletion(demoUserId, quest.id, false, '2026-10-28');
    expect(undone.stamp_card.filled_count).toBe(0);
    expect(undone.stamp_card.stamped_dates).toEqual([]);
  });

  // AC: A full stamp card triggers a reward message from Mochi and starts a new card
  // AC: Past stamp cards and stamp history are saved
  it('rewards a full card, keeps history, and starts a fresh card', async () => {
    const { service: questService } = service();
    // Seed STAMPS_PER_CARD - 1 stamps on card 1 so the next active day fills it.
    for (let i = 0; i < STAMPS_PER_CARD - 1; i += 1) {
      const day = `2026-10-${String(i + 1).padStart(2, '0')}`;
      await db.query(
        `INSERT INTO stamps (user_id, card_number, stamp_date) VALUES ($1, 1, $2)`,
        [demoUserId, day],
      );
    }

    const before = await questService.getToday(demoUserId, '2026-10-28');
    expect(before.stamp_card.card_number).toBe(1);
    expect(before.stamp_card.filled_count).toBe(STAMPS_PER_CARD - 1);

    const quest = before.quests[0];
    const filled = await questService.setCompletion(demoUserId, quest.id, true, '2026-10-28');
    expect(filled.card_completed).toBe(true);
    expect(filled.card_reward_message).toMatch(/Stamp card 1/);
    expect(filled.card_reward_message).toMatch(/Mochi/i);
    // Current card advances to an empty new card.
    expect(filled.stamp_card.card_number).toBe(2);
    expect(filled.stamp_card.filled_count).toBe(0);
    expect(filled.stamp_card.past_cards).toHaveLength(1);
    expect(filled.stamp_card.past_cards[0]?.card_number).toBe(1);
    expect(filled.stamp_card.past_cards[0]?.stamp_count).toBe(STAMPS_PER_CARD);
    expect(filled.stamp_card.past_cards[0]?.stamp_dates).toContain('2026-10-28');
  });
});
