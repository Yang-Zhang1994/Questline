import type { Quest, TodayQuestsResponse } from '@questline/shared';
import type { Clock } from '../clock.js';
import { formatLocalDate, toIsoDateTime } from '../clock.js';
import type { QuestRepository } from '../repositories/questRepository.js';
import { notFound } from './errors.js';

export type QuestServiceDeps = {
  quests: QuestRepository;
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

export function createQuestService(deps: QuestServiceDeps) {
  return {
    async getToday(userId: number, localDate?: string): Promise<TodayQuestsResponse> {
      const date = localDate ?? formatLocalDate(deps.clock.now());
      const ctx = await deps.quests.listDueOnDateForActiveGoal(userId, date);
      const doneCount = ctx.quests.filter((q) => q.completed_at !== null).length;

      return {
        local_date: date,
        goal_title: ctx.goalTitle,
        milestone_title: ctx.milestoneTitle,
        greeting: greetingFor(deps.clock.now().getHours(), doneCount, ctx.quests.length),
        quests: ctx.quests,
        done_count: doneCount,
        total_count: ctx.quests.length,
      };
    },

    async setCompletion(userId: number, questId: number, completed: boolean): Promise<Quest> {
      const existing = await deps.quests.findByIdForUser(userId, questId);
      if (!existing) {
        throw notFound(`Quest ${questId} was not found`);
      }

      if (completed) {
        if (existing.completed_at !== null) {
          return existing;
        }
        const updated = await deps.quests.setCompletedAtForUser(
          userId,
          questId,
          toIsoDateTime(deps.clock.now()),
        );
        if (!updated) {
          throw notFound(`Quest ${questId} was not found`);
        }
        return updated;
      }

      if (existing.completed_at === null) {
        return existing;
      }
      const cleared = await deps.quests.setCompletedAtForUser(userId, questId, null);
      if (!cleared) {
        throw notFound(`Quest ${questId} was not found`);
      }
      return cleared;
    },
  };
}

export type QuestService = ReturnType<typeof createQuestService>;
