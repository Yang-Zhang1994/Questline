import { describe, expect, it, vi } from 'vitest';
import type { DiaryNote } from '@questline/shared';
import type { Clock } from '../clock.js';
import type { DiaryNoteRepository } from '../repositories/diaryNoteRepository.js';
import type { GoalRepository } from '../repositories/goalRepository.js';
import { createDiaryNoteService } from './diaryNoteService.js';
import { AppError } from './errors.js';

const clock: Clock = {
  now: () => new Date('2026-11-09T15:00:00.000Z'),
};

function makeGoal(id = 7) {
  return {
    id,
    user_id: 1,
    title: 'Read a Japanese novel',
    done_definition: null,
    starting_point: null,
    time_budget_minutes_per_day: null,
    deadline: null,
    status: 'active' as const,
    created_at: '2026-11-01T00:00:00Z',
  };
}

describe('diaryNoteService (Issue #19)', () => {
  it('returns empty content when no row exists for the active goal', async () => {
    const diaryNotes = {
      findByGoalAndDate: vi.fn().mockResolvedValue(null),
      upsertForGoal: vi.fn(),
    } satisfies DiaryNoteRepository;
    const goals = {
      findActiveForUser: vi.fn().mockResolvedValue(makeGoal()),
    } as unknown as GoalRepository;

    const service = createDiaryNoteService({ diaryNotes, goals, clock });
    const note = await service.getTodayNote(1, '2026-11-09');

    expect(note).toEqual({
      id: null,
      goal_id: 7,
      note_date: '2026-11-09',
      content: '',
      updated_at: null,
    });
    expect(diaryNotes.findByGoalAndDate).toHaveBeenCalledWith(7, '2026-11-09');
  });

  it('upserts against the active goal for the local date', async () => {
    const saved: DiaryNote = {
      id: 3,
      goal_id: 7,
      note_date: '2026-11-09',
      content: 'hello diary',
      updated_at: '2026-11-09T15:00:00Z',
    };
    const diaryNotes = {
      findByGoalAndDate: vi.fn(),
      upsertForGoal: vi.fn().mockResolvedValue(saved),
    } satisfies DiaryNoteRepository;
    const goals = {
      findActiveForUser: vi.fn().mockResolvedValue(makeGoal()),
    } as unknown as GoalRepository;

    const service = createDiaryNoteService({ diaryNotes, goals, clock });
    const note = await service.upsertTodayNote(1, 'hello diary', '2026-11-09');

    expect(note).toEqual(saved);
    expect(diaryNotes.upsertForGoal).toHaveBeenCalledWith(7, '2026-11-09', 'hello diary');
  });

  it('throws NOT_FOUND when saving without an active goal', async () => {
    const diaryNotes = {
      findByGoalAndDate: vi.fn(),
      upsertForGoal: vi.fn(),
    } satisfies DiaryNoteRepository;
    const goals = {
      findActiveForUser: vi.fn().mockResolvedValue(null),
    } as unknown as GoalRepository;

    const service = createDiaryNoteService({ diaryNotes, goals, clock });
    await expect(service.upsertTodayNote(1, 'oops')).rejects.toBeInstanceOf(AppError);
  });
});
