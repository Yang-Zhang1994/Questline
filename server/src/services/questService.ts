import {
  QuestGenerationAiResponseSchema,
  createQuestProposalListSchema,
  type CurrentMilestoneQuestsResponse,
  type ProposedQuest,
  type StageReadySummary,
  type ToggleQuestCompletionResponse,
  type UserProgress,
} from '@questline/shared';
import type { ChatAiClient } from '../ai/client.js';
import {
  buildDefaultQuestProposal,
  computeQuestGenerationWindow,
} from '../ai/prompts/mochiQuests.js';
import type { Clock } from '../clock.js';
import { resolveClientLocalDate, toIsoDateTime } from '../clock.js';
import { DEFAULT_TIME_BUDGET_MINUTES, XP_PER_QUEST, levelUpMessage } from '../config/game.js';
import { mapGoalRowToRoadmapGoal } from '../repositories/goalRepository.js';
import type { ProgressRepository } from '../repositories/progressRepository.js';
import type { QuestRepository } from '../repositories/questRepository.js';
import { aiUnavailable, notFound } from './errors.js';

export type QuestServiceDeps = {
  quests: QuestRepository;
  progress: ProgressRepository;
  ai: ChatAiClient;
  clock: Clock;
};

type StageReadiness = {
  stage_ready: boolean;
  stage_ready_milestone: StageReadySummary | null;
};

const NOT_READY: StageReadiness = { stage_ready: false, stage_ready_milestone: null };

function stageFromMilestoneQuests(
  milestoneId: number,
  milestoneTitle: string,
  quests: Array<{ completed_at: string | null }>,
): StageReadiness {
  if (quests.length === 0) return NOT_READY;
  if (!quests.every((q) => q.completed_at !== null)) return NOT_READY;
  return {
    stage_ready: true,
    stage_ready_milestone: {
      milestone_id: milestoneId,
      milestone_title: milestoneTitle,
    },
  };
}

function completionPayload(
  quest: ToggleQuestCompletionResponse['quest'],
  progress: UserProgress,
  leveledUp: boolean,
  stage: StageReadiness,
): ToggleQuestCompletionResponse {
  return {
    quest,
    progress,
    leveled_up: leveledUp,
    level_up_message: leveledUp ? levelUpMessage(progress.level) : null,
    stage_ready: stage.stage_ready,
    stage_ready_milestone: stage.stage_ready_milestone,
  };
}

export function createQuestService(deps: QuestServiceDeps) {
  function normalizeGoal(goal: CurrentMilestoneQuestsResponse['goal']) {
    if (!goal) return null;
    return mapGoalRowToRoadmapGoal({
      id: goal.id,
      title: goal.title,
      done_definition: goal.done_definition ?? null,
      starting_point: goal.starting_point ?? null,
      time_budget_minutes_per_day: goal.time_budget_minutes_per_day ?? null,
      deadline: goal.deadline,
      status: goal.status,
    });
  }

  /**
   * Read-only: returns saved quests for the logged-in user's active goal and its
   * `status = 'current'` milestone without invoking the AI client.
   */
  async function getCurrentMilestoneQuests(
    userId: number,
    localDate?: string,
  ): Promise<CurrentMilestoneQuestsResponse> {
    const today = resolveClientLocalDate(localDate, deps.clock);
    const { goal: rawGoal, milestone } = await deps.quests.getCurrentMilestoneContextForUser(userId);
    const goal = normalizeGoal(rawGoal);
    const progress = await deps.progress.getOrCreate(userId, today);

    const { windowStart, windowEnd } = computeQuestGenerationWindow(
      today,
      milestone?.target_date ?? null,
    );

    if (!goal || !milestone) {
      return {
        goal,
        milestone: null,
        window_start: windowStart,
        window_end: windowEnd,
        quests: [],
        progress,
        ...NOT_READY,
      };
    }

    const quests = await deps.quests.listForMilestone(userId, milestone.id);
    const stage = stageFromMilestoneQuests(milestone.id, milestone.title, quests);
    return {
      goal,
      milestone,
      window_start: windowStart,
      window_end: windowEnd,
      quests,
      progress,
      ...stage,
    };
  }

  /**
   * Generates and saves daily quests for the logged-in user's active goal and its
   * `status = 'current'` milestone ONLY if no quests exist yet in the starting window.
   */
  async function generateCurrentMilestoneQuests(
    userId: number,
    localDate?: string,
  ): Promise<CurrentMilestoneQuestsResponse> {
    const today = resolveClientLocalDate(localDate, deps.clock);
    const { goal: rawGoal, milestone } = await deps.quests.getCurrentMilestoneContextForUser(userId);
    const goal = normalizeGoal(rawGoal);
    const progress = await deps.progress.getOrCreate(userId, today);

    if (!goal) {
      throw notFound('Confirm a goal first before generating quests.');
    }
    if (!milestone) {
      throw notFound('Confirm a milestone plan with a current stage before generating quests.');
    }

    const { windowStart, windowEnd } = computeQuestGenerationWindow(today, milestone.target_date);

    // Fast path: if quests already exist in the window, return saved quests without calling AI.
    const existingInWindow = await deps.quests.listForMilestoneInWindow(
      userId,
      milestone.id,
      windowStart,
      windowEnd,
    );
    if (existingInWindow.length > 0) {
      const quests = await deps.quests.listForMilestone(userId, milestone.id);
      const stage = stageFromMilestoneQuests(milestone.id, milestone.title, quests);
      return {
        goal,
        milestone,
        window_start: windowStart,
        window_end: windowEnd,
        quests,
        progress,
        ...stage,
      };
    }

    const timeBudgetMinutesPerDay =
      goal.time_budget_minutes_per_day && goal.time_budget_minutes_per_day > 0
        ? goal.time_budget_minutes_per_day
        : DEFAULT_TIME_BUDGET_MINUTES;

    const validationSchema = QuestGenerationAiResponseSchema.extend({
      quests: createQuestProposalListSchema({
        windowStart,
        windowEnd,
        milestoneTargetDate: milestone.target_date,
        timeBudgetMinutesPerDay,
      }),
    });

    const generateAndValidate = async (): Promise<ProposedQuest[]> => {
      const requestInput = {
        goal,
        milestone,
        windowStart,
        windowEnd,
        timeBudgetMinutesPerDay,
      };

      let rawProposal;
      try {
        rawProposal = deps.ai.generateDailyQuests
          ? await deps.ai.generateDailyQuests(requestInput)
          : buildDefaultQuestProposal(requestInput);
      } catch {
        throw aiUnavailable();
      }

      const parsed = validationSchema.safeParse(rawProposal);
      if (!parsed.success) {
        throw aiUnavailable(
          'Mochi got a little tangled while sketching your daily quests. Please try again in a moment.',
        );
      }

      return parsed.data.quests;
    };

    const quests = await deps.quests.saveGeneratedQuestsIfEmpty(
      userId,
      milestone.id,
      windowStart,
      windowEnd,
      generateAndValidate,
    );

    const updatedMilestone = {
      ...milestone,
      total_quests: quests.length,
      done_quests: quests.filter((q) => q.completed_at !== null).length,
    };

    const stage = stageFromMilestoneQuests(updatedMilestone.id, updatedMilestone.title, quests);
    return {
      goal,
      milestone: updatedMilestone,
      window_start: windowStart,
      window_end: windowEnd,
      quests,
      progress,
      ...stage,
    };
  }

  async function stageReadiness(userId: number): Promise<StageReadiness> {
    const { milestone } = await deps.quests.getCurrentMilestoneContextForUser(userId);
    if (!milestone) return NOT_READY;
    const quests = await deps.quests.listForMilestone(userId, milestone.id);
    return stageFromMilestoneQuests(milestone.id, milestone.title, quests);
  }

  /**
   * Toggles quest completion for a quest owned by `userId`.
   * Checking awards XP + streak; undoing reverses both — same transaction (#11 / #12).
   * Stage-ready detection runs after that transaction (#10).
   */
  async function toggleQuestCompletion(
    userId: number,
    questId: number,
    completed: boolean,
    localDate?: string,
  ): Promise<ToggleQuestCompletionResponse> {
    const date = resolveClientLocalDate(localDate, deps.clock);
    const existing = await deps.quests.findByIdForUser(userId, questId);
    if (!existing) {
      throw notFound('Quest not found.');
    }

    // Idempotent no-ops: still return current progress for the HUD.
    if (completed && existing.completed_at !== null) {
      const progress = await deps.progress.getOrCreate(userId, date);
      const stage = await stageReadiness(userId);
      return completionPayload(existing, progress, false, stage);
    }
    if (!completed && existing.completed_at === null) {
      const progress = await deps.progress.getOrCreate(userId, date);
      const stage = await stageReadiness(userId);
      return completionPayload(existing, progress, false, stage);
    }

    const result = await deps.quests.setCompletionWithXp(
      userId,
      questId,
      completed ? toIsoDateTime(deps.clock.now()) : null,
      completed ? XP_PER_QUEST : -XP_PER_QUEST,
      date,
    );
    if (!result) {
      throw notFound('Quest not found.');
    }

    const leveledUp = completed && result.progress.level > result.previousLevel;
    const stage = await stageReadiness(userId);
    return completionPayload(result.quest, result.progress, leveledUp, stage);
  }

  return {
    getCurrentMilestoneQuests,
    generateCurrentMilestoneQuests,
    toggleQuestCompletion,
  };
}

export type QuestService = ReturnType<typeof createQuestService>;
