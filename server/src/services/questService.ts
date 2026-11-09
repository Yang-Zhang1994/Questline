import type {
  Quest,
  TodayQuestsResponse,
  ToggleQuestCompletionResponse,
  UserProgress,
} from '@questline/shared';
import type { Clock } from '../clock.js';
import { formatLocalDate, toIsoDateTime } from '../clock.js';
import { XP_PER_QUEST, levelUpMessage } from '../config/game.js';
import type { ProgressRepository } from '../repositories/progressRepository.js';
import type { QuestRepository } from '../repositories/questRepository.js';
import { notFound } from './errors.js';

export type QuestServiceDeps = {
  quests: QuestRepository;
  progress: ProgressRepository;
  clock: Clock;
};

function greetingFor(hour: number, doneCount: number, totalCount: number): string {
  const timePart = hour < 12 ? 'Good morning!' : hour < 18 ? 'Good afternoon!' : 'Good evening!';

  if (totalCount === 0) {
    return `${timePart} No quests lined up for today — enjoy a gentle rest day.`;
  }

  if (doneCount === totalCount) {
    return `${timePart} You finished every quest today. Mochi is proud of you.`;
  }

  return `${timePart} Here are today's little quests. Check them off when you're ready — you can always undo.`;
}

function completionPayload(
  quest: Quest,
  progress: UserProgress,
  leveledUp: boolean,
): ToggleQuestCompletionResponse {
  return {
    quest,
    progress,
    leveled_up: leveledUp,
    level_up_message: leveledUp ? levelUpMessage(progress.level) : null,
  };
}

export function createQuestService(deps: QuestServiceDeps) {
  return {
    async getToday(userId: number, localDate?: string): Promise<TodayQuestsResponse> {
      const date = localDate ?? formatLocalDate(deps.clock.now());
      const ctx = await deps.quests.listDueOnDateForActiveGoal(userId, date);
      const doneCount = ctx.quests.filter((q) => q.completed_at !== null).length;
      const progress = await deps.progress.getOrCreate(userId);

      return {
        local_date: date,
        goal_title: ctx.goalTitle,
        milestone_title: ctx.milestoneTitle,
        greeting: greetingFor(deps.clock.now().getHours(), doneCount, ctx.quests.length),
        quests: ctx.quests,
        done_count: doneCount,
        total_count: ctx.quests.length,
        progress,
      };
    },

    async setCompletion(
      userId: number,
      questId: number,
      completed: boolean,
    ): Promise<ToggleQuestCompletionResponse> {
      const existing = await deps.quests.findByIdForUser(userId, questId);
      if (!existing) {
        throw notFound(`Quest ${questId} was not found`);
      }

      // Idempotent no-ops: still return current progress for the HUD.
      if (completed && existing.completed_at !== null) {
        const progress = await deps.progress.getOrCreate(userId);
        return completionPayload(existing, progress, false);
      }
      if (!completed && existing.completed_at === null) {
        const progress = await deps.progress.getOrCreate(userId);
        return completionPayload(existing, progress, false);
      }

      const result = await deps.quests.setCompletionWithXp(
        userId,
        questId,
        completed ? toIsoDateTime(deps.clock.now()) : null,
        completed ? XP_PER_QUEST : -XP_PER_QUEST,
      );
      if (!result) {
        throw notFound(`Quest ${questId} was not found`);
      }

      const leveledUp = completed && result.progress.level > result.previousLevel;
      return completionPayload(result.quest, result.progress, leveledUp);
    },
  };
}

export type QuestService = ReturnType<typeof createQuestService>;
