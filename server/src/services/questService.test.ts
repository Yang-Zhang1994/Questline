import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '../clock.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { seedDemoDataIfEmpty } from '../db/seed.js';
import { createQuestRepository } from '../repositories/questRepository.js';
import { createQuestService } from './questService.js';
import { AppError } from './errors.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

describe('questService (Issue #9 / #17 / #31 Postgres)', () => {
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
    return { quests, service: createQuestService({ quests, clock }) };
  }

  // AC: User can mark a quest as done from the daily note
  it('marks a quest completed and returns completed_at', async () => {
    const { service: questService } = service();
    const today = await questService.getToday(demoUserId);
    const quest = today.quests[0];
    expect(quest).toBeDefined();
    expect(quest.completed_at).toBeNull();

    const updated = await questService.setCompletion(demoUserId, quest.id, true);
    expect(updated.completed_at).toBe('2026-10-28T15:30:00Z');
  });

  // AC: User can undo an accidental check-off
  it('clears completed_at when undoing a check-off', async () => {
    const { service: questService } = service();
    const quest = (await questService.getToday(demoUserId)).quests[0];
    await questService.setCompletion(demoUserId, quest.id, true);
    const undone = await questService.setCompletion(demoUserId, quest.id, false);
    expect(undone.completed_at).toBeNull();
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
  });
});
