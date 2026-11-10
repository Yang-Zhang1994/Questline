import type {
  Quest,
  StageReadySummary,
  StampCard,
  TodayQuestsResponse,
  ToggleQuestCompletionResponse,
  UserProgress,
} from '@questline/shared';
import type { Clock } from '../clock.js';
import { formatLocalDate, toIsoDateTime } from '../clock.js';
import { XP_PER_QUEST, levelUpMessage, stampCardRewardMessage } from '../config/game.js';
import type { ProgressRepository } from '../repositories/progressRepository.js';
import type { QuestRepository } from '../repositories/questRepository.js';
import type { StampRepository } from '../repositories/stampRepository.js';
import { notFound } from './errors.js';

export type QuestServiceDeps = {
  quests: QuestRepository;
  progress: ProgressRepository;
  stamps: StampRepository;
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

async function stageReadiness(
  quests: QuestRepository,
  userId: number,
): Promise<{ stage_ready: boolean; stage_ready_milestone: StageReadySummary | null }> {
  const ctx = await quests.findCurrentMilestoneQuestContext(userId);
  if (!ctx || ctx.quests.length === 0) {
    return { stage_ready: false, stage_ready_milestone: null };
  }
  const ready = ctx.quests.every((q) => q.completed_at !== null);
  if (!ready) {
    return { stage_ready: false, stage_ready_milestone: null };
  }
  return {
    stage_ready: true,
    stage_ready_milestone: {
      milestone_id: ctx.milestone.id,
      milestone_title: ctx.milestone.title,
    },
  };
}

function completionPayload(
  quest: Quest,
  progress: UserProgress,
  leveledUp: boolean,
  stampCard: StampCard,
  cardCompleted: boolean,
  completedCardNumber: number | null,
  stage: { stage_ready: boolean; stage_ready_milestone: StageReadySummary | null },
): ToggleQuestCompletionResponse {
  return {
    quest,
    progress,
    leveled_up: leveledUp,
    level_up_message: leveledUp ? levelUpMessage(progress.level) : null,
    stamp_card: stampCard,
    card_completed: cardCompleted,
    card_reward_message:
      cardCompleted && completedCardNumber != null
        ? stampCardRewardMessage(completedCardNumber)
        : null,
    stage_ready: stage.stage_ready,
    stage_ready_milestone: stage.stage_ready_milestone,
  };
}

export function createQuestService(deps: QuestServiceDeps) {
  return {
    async getToday(userId: number, localDate?: string): Promise<TodayQuestsResponse> {
      const date = localDate ?? formatLocalDate(deps.clock.now());
      const ctx = await deps.quests.listDueOnDateForActiveGoal(userId, date);
      const overdue_quests = await deps.quests.listOverdueForActiveGoal(userId, date);
      const doneCount = ctx.quests.filter((q) => q.completed_at !== null).length;
      const progress = await deps.progress.getOrCreate(userId, date);
      const stamp_card = await deps.stamps.getCardState(userId);
      const stage = await stageReadiness(deps.quests, userId);

      return {
        local_date: date,
        goal_title: ctx.goalTitle,
        milestone_title: ctx.milestoneTitle,
        greeting: greetingFor(deps.clock.now().getHours(), doneCount, ctx.quests.length),
        quests: ctx.quests,
        overdue_quests,
        done_count: doneCount,
        total_count: ctx.quests.length,
        progress,
        stamp_card,
        stage_ready: stage.stage_ready,
        stage_ready_milestone: stage.stage_ready_milestone,
      };
    },

    async setCompletion(
      userId: number,
      questId: number,
      completed: boolean,
      localDate?: string,
    ): Promise<ToggleQuestCompletionResponse> {
      const existing = await deps.quests.findByIdForUser(userId, questId);
      if (!existing) {
        throw notFound(`Quest ${questId} was not found`);
      }

      const date = localDate ?? formatLocalDate(deps.clock.now());

      // Idempotent no-ops: still return current progress + stamp card for the HUD.
      if (completed && existing.completed_at !== null) {
        const progress = await deps.progress.getOrCreate(userId, date);
        const stamp_card = await deps.stamps.getCardState(userId);
        const stage = await stageReadiness(deps.quests, userId);
        return completionPayload(existing, progress, false, stamp_card, false, null, stage);
      }
      if (!completed && existing.completed_at === null) {
        const progress = await deps.progress.getOrCreate(userId, date);
        const stamp_card = await deps.stamps.getCardState(userId);
        const stage = await stageReadiness(deps.quests, userId);
        return completionPayload(existing, progress, false, stamp_card, false, null, stage);
      }

      // XP / streak / stamps stay inside this transaction — no milestone status writes.
      const result = await deps.quests.setCompletionWithXp(
        userId,
        questId,
        completed ? toIsoDateTime(deps.clock.now()) : null,
        completed ? XP_PER_QUEST : -XP_PER_QUEST,
        date,
      );
      if (!result) {
        throw notFound(`Quest ${questId} was not found`);
      }

      const leveledUp = completed && result.progress.level > result.previousLevel;
      // Detect stage-ready AFTER the completion commit (Issue #10).
      const stage = await stageReadiness(deps.quests, userId);
      return completionPayload(
        result.quest,
        result.progress,
        leveledUp,
        result.stamp_card,
        result.card_completed,
        result.completed_card_number,
        stage,
      );
    },
  };
}

export type QuestService = ReturnType<typeof createQuestService>;
