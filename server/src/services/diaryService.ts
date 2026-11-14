import { DiaryNoteContentSchema, type DiaryNote } from '@questline/shared';
import type { Clock } from '../clock.js';
import { resolveClientLocalDate, toIsoDateTime } from '../clock.js';
import type { DiaryRepository } from '../repositories/diaryRepository.js';
import type { GoalRepository } from '../repositories/goalRepository.js';
import { notFound, validationError } from './errors.js';

export type DiaryServiceDeps = {
  diary: DiaryRepository;
  goals: Pick<GoalRepository, 'findActiveForUser'>;
  clock: Clock;
};

export function createDiaryService(deps: DiaryServiceDeps) {
  async function getTodayNote(userId: number, localDate?: string): Promise<DiaryNote> {
    const noteDate = resolveClientLocalDate(localDate, deps.clock);
    const activeGoal = await deps.goals.findActiveForUser(userId);
    if (!activeGoal) {
      return {
        id: null,
        goal_id: null,
        note_date: noteDate,
        content: '',
        updated_at: null,
      };
    }

    const saved = await deps.diary.findByGoalAndDate(activeGoal.id, noteDate);
    if (saved) {
      return saved;
    }

    return {
      id: null,
      goal_id: activeGoal.id,
      note_date: noteDate,
      content: '',
      updated_at: null,
    };
  }

  async function upsertTodayNote(
    userId: number,
    content: string,
    localDate?: string,
  ): Promise<DiaryNote> {
    const parsedContent = DiaryNoteContentSchema.safeParse(content);
    if (!parsedContent.success) {
      throw validationError(parsedContent.error.issues.map((issue) => issue.message).join('; '));
    }

    const noteDate = resolveClientLocalDate(localDate, deps.clock);
    const activeGoal = await deps.goals.findActiveForUser(userId);
    if (!activeGoal) {
      throw notFound('Confirm an active goal before saving a diary note.');
    }

    const updatedAt = toIsoDateTime(deps.clock.now());
    return deps.diary.upsert(activeGoal.id, noteDate, parsedContent.data, updatedAt);
  }

  return {
    getTodayNote,
    upsertTodayNote,
  };
}

export type DiaryService = ReturnType<typeof createDiaryService>;
