import type { DiaryNoteResponse } from '@questline/shared';
import { formatLocalDate, type Clock } from '../clock.js';
import type { DiaryNoteRepository } from '../repositories/diaryNoteRepository.js';
import type { GoalRepository } from '../repositories/goalRepository.js';
import { notFound } from './errors.js';

export type DiaryNoteServiceDeps = {
  diaryNotes: DiaryNoteRepository;
  goals: GoalRepository;
  clock: Clock;
};

function emptyNote(noteDate: string, goalId: number | null = null): DiaryNoteResponse {
  return {
    id: null,
    goal_id: goalId,
    note_date: noteDate,
    content: '',
    updated_at: null,
  };
}

export function createDiaryNoteService(deps: DiaryNoteServiceDeps) {
  function resolveDate(localDate?: string): string {
    return localDate ?? formatLocalDate(deps.clock.now());
  }

  async function requireActiveGoal(userId: number) {
    const goal = await deps.goals.findActiveForUser(userId);
    if (!goal) {
      throw notFound("Start a goal with Mochi first — then we'll keep a diary for it ♡");
    }
    return goal;
  }

  async function getTodayNote(
    userId: number,
    localDate?: string,
  ): Promise<DiaryNoteResponse> {
    const noteDate = resolveDate(localDate);
    const goal = await deps.goals.findActiveForUser(userId);
    if (!goal) {
      return emptyNote(noteDate);
    }
    const existing = await deps.diaryNotes.findByGoalAndDate(goal.id, noteDate);
    if (!existing) {
      return emptyNote(noteDate, goal.id);
    }
    return existing;
  }

  async function upsertTodayNote(
    userId: number,
    content: string,
    localDate?: string,
  ): Promise<DiaryNoteResponse> {
    const noteDate = resolveDate(localDate);
    const goal = await requireActiveGoal(userId);
    return deps.diaryNotes.upsertForGoal(goal.id, noteDate, content);
  }

  return {
    getTodayNote,
    upsertTodayNote,
  };
}

export type DiaryNoteService = ReturnType<typeof createDiaryNoteService>;
