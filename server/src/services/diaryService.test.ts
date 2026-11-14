import { describe, expect, it } from 'vitest';
import { MAX_DIARY_NOTE_LENGTH, type DiaryNote, type Goal } from '@questline/shared';
import type { Clock } from '../clock.js';
import type { DiaryRepository } from '../repositories/diaryRepository.js';
import { createDiaryService } from './diaryService.js';
import { AppError } from './errors.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

const activeGoalUser1: Goal = {
  id: 10,
  user_id: 1,
  title: 'Read a Japanese novel on my own',
  done_definition: 'Finish one short novel',
  starting_point: 'Know hiragana',
  time_budget_minutes_per_day: 25,
  deadline: '2027-06-30',
  status: 'active',
  created_at: '2026-11-01T12:00:00Z',
};

describe('diaryService (Issue #19)', () => {
  const clock = fixedClock('2026-11-10T15:00:00.000Z');

  function buildDeps(options?: { activeGoalByUser?: Map<number, Goal | null> }) {
    const activeGoals =
      options?.activeGoalByUser ?? new Map<number, Goal | null>([[1, activeGoalUser1]]);
    const rows: DiaryNote[] = [];
    let nextId = 1;

    const diary: DiaryRepository & { rows: DiaryNote[] } = {
      rows,
      async findByGoalAndDate(goalId: number, noteDate: string) {
        return rows.find((r) => r.goal_id === goalId && r.note_date === noteDate) ?? null;
      },
      async upsert(goalId: number, noteDate: string, content: string, updatedAt: string) {
        const existingIdx = rows.findIndex(
          (r) => r.goal_id === goalId && r.note_date === noteDate,
        );
        if (existingIdx !== -1) {
          const updated: DiaryNote = {
            ...rows[existingIdx],
            content,
            updated_at: updatedAt,
          };
          rows[existingIdx] = updated;
          return updated;
        }
        const created: DiaryNote = {
          id: nextId++,
          goal_id: goalId,
          note_date: noteDate,
          content,
          updated_at: updatedAt,
        };
        rows.push(created);
        return created;
      },
    };

    const goals = {
      async findActiveForUser(userId: number) {
        return activeGoals.get(userId) ?? null;
      },
    };

    return {
      diary,
      goals,
      service: createDiaryService({ diary, goals, clock }),
    };
  }

  it('returns an empty note snapshot when no note is saved for today yet', async () => {
    const { service } = buildDeps();
    const note = await service.getTodayNote(1, '2026-11-10');

    expect(note).toEqual({
      id: null,
      goal_id: 10,
      note_date: '2026-11-10',
      content: '',
      updated_at: null,
    });
  });

  it('saves and reloads the same day note, updating in place on second save (one note per goal per day)', async () => {
    const { service, diary } = buildDeps();

    const first = await service.upsertTodayNote(
      1,
      'Read two pages and felt cozy ♡',
      '2026-11-10',
    );
    expect(first.id).toBe(1);
    expect(first.goal_id).toBe(10);
    expect(first.note_date).toBe('2026-11-10');
    expect(first.content).toBe('Read two pages and felt cozy ♡');
    expect(diary.rows).toHaveLength(1);

    const updated = await service.upsertTodayNote(
      1,
      'Read three pages and learned two new words!',
      '2026-11-10',
    );
    expect(updated.id).toBe(1);
    expect(updated.content).toBe('Read three pages and learned two new words!');
    expect(diary.rows).toHaveLength(1);

    const reloaded = await service.getTodayNote(1, '2026-11-10');
    expect(reloaded).toEqual(updated);
  });

  it('accepts local_date within ±1 day of the server clock and rejects dates outside ±1 day or invalid calendar dates', async () => {
    const { service } = buildDeps();

    // Within ±1 day of 2026-11-10
    await expect(service.getTodayNote(1, '2026-11-09')).resolves.toMatchObject({
      note_date: '2026-11-09',
    });
    await expect(service.getTodayNote(1, '2026-11-11')).resolves.toMatchObject({
      note_date: '2026-11-11',
    });

    // Outside ±1 day
    await expect(service.getTodayNote(1, '2026-11-08')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    } satisfies Partial<AppError>);
    await expect(service.upsertTodayNote(1, 'Too far future', '2026-11-12')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    } satisfies Partial<AppError>);

    // Non-existent calendar date
    await expect(service.upsertTodayNote(1, 'Fake date', '2026-02-30')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    } satisfies Partial<AppError>);
  });

  it('rejects content longer than MAX_DIARY_NOTE_LENGTH (2000 characters)', async () => {
    const { service, diary } = buildDeps();
    const tooLong = 'a'.repeat(MAX_DIARY_NOTE_LENGTH + 1);

    await expect(service.upsertTodayNote(1, tooLong, '2026-11-10')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    } satisfies Partial<AppError>);
    expect(diary.rows).toHaveLength(0);
  });

  it('isolates notes by user and active goal and returns 404 when saving without an active goal', async () => {
    const { service } = buildDeps();

    await service.upsertTodayNote(1, 'User 1 secret reflection', '2026-11-10');

    // User 2 has no active goal: cannot see user 1's note and gets 404 when trying to save
    const user2Note = await service.getTodayNote(2, '2026-11-10');
    expect(user2Note).toEqual({
      id: null,
      goal_id: null,
      note_date: '2026-11-10',
      content: '',
      updated_at: null,
    });

    await expect(service.upsertTodayNote(2, 'Intruder note', '2026-11-10')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    } satisfies Partial<AppError>);
  });
});
