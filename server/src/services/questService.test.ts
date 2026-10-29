import { describe, expect, it } from 'vitest';
import type { Clock } from '../clock.js';
import { openDatabase } from '../db/connection.js';
import { seedDemoDataIfEmpty } from '../db/seed.js';
import { createQuestRepository } from '../repositories/questRepository.js';
import { createQuestService } from './questService.js';
import { AppError } from './errors.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

function setup(iso = '2026-10-28T15:30:00.000Z') {
  const clock = fixedClock(iso);
  const db = openDatabase({ filename: ':memory:' });
  seedDemoDataIfEmpty(db, clock);
  const quests = createQuestRepository(db);
  const service = createQuestService({ quests, clock });
  return { db, clock, quests, service };
}

describe('questService (Issue #9)', () => {
  // AC: User can mark a quest as done from the daily note
  it('marks a quest completed and returns completed_at', () => {
    const { service } = setup();
    const today = service.getToday();
    const quest = today.quests[0];
    expect(quest).toBeDefined();
    expect(quest.completed_at).toBeNull();

    const updated = service.setCompletion(quest.id, true);
    expect(updated.completed_at).toBe('2026-10-28T15:30:00Z');
  });

  // AC: User can undo an accidental check-off
  it('clears completed_at when undoing a check-off', () => {
    const { service } = setup();
    const quest = service.getToday().quests[0];
    service.setCompletion(quest.id, true);
    const undone = service.setCompletion(quest.id, false);
    expect(undone.completed_at).toBeNull();
  });

  // AC: Completion status and completion time are saved
  it('persists completion status and timestamp via the repository', () => {
    const { service, quests } = setup();
    const quest = service.getToday().quests[1];
    service.setCompletion(quest.id, true);
    const stored = quests.findById(quest.id);
    expect(stored?.completed_at).toBe('2026-10-28T15:30:00Z');
  });

  // AC: Completed quests stay completed after a page reload
  it('keeps completed quests completed when today is fetched again', () => {
    const { service } = setup();
    const quest = service.getToday().quests[0];
    service.setCompletion(quest.id, true);

    const reloaded = service.getToday();
    const found = reloaded.quests.find((q) => q.id === quest.id);
    expect(found?.completed_at).toBe('2026-10-28T15:30:00Z');
    expect(reloaded.done_count).toBe(1);
  });

  it('throws NOT_FOUND for unknown quest ids', () => {
    const { service } = setup();
    expect(() => service.setCompletion(9999, true)).toThrow(AppError);
  });
});
