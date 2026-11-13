import {
  QuestGenerationAiResponseSchema,
  createQuestProposalListSchema,
  type CurrentMilestoneQuestsResponse,
  type ProposedQuest,
  type ToggleQuestCompletionResponse,
  type UserProgress,
} from '@questline/shared';
import type { ChatAiClient } from '../ai/client.js';
import {
  buildDefaultQuestProposal,
  computeQuestGenerationWindow,
} from '../ai/prompts/mochiQuests.js';
import type { Clock } from '../clock.js';
import { formatLocalDate, toIsoDateTime } from '../clock.js';
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

function completionPayload(
  quest: ToggleQuestCompletionResponse['quest'],
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
  async function getCurrentMilestoneQuests(userId: number): Promise<CurrentMilestoneQuestsResponse> {
    const today = formatLocalDate(deps.clock.now());
    const { goal: rawGoal, milestone } = await deps.quests.getCurrentMilestoneContextForUser(userId);
    const goal = normalizeGoal(rawGoal);
    const progress = await deps.progress.getOrCreate(userId);

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
      };
    }

    const quests = await deps.quests.listForMilestone(userId, milestone.id);
    return {
      goal,
      milestone,
      window_start: windowStart,
      window_end: windowEnd,
      quests,
      progress,
    };
  }

  /**
   * Generates and saves daily quests for the logged-in user's active goal and its
   * `status = 'current'` milestone ONLY if no quests exist yet in the starting window.
   */
  async function generateCurrentMilestoneQuests(
    userId: number,
  ): Promise<CurrentMilestoneQuestsResponse> {
    const today = formatLocalDate(deps.clock.now());
    const { goal: rawGoal, milestone } = await deps.quests.getCurrentMilestoneContextForUser(userId);
    const goal = normalizeGoal(rawGoal);
    const progress = await deps.progress.getOrCreate(userId);

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
      return {
        goal,
        milestone,
        window_start: windowStart,
        window_end: windowEnd,
        quests,
        progress,
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

    return {
      goal,
      milestone: updatedMilestone,
      window_start: windowStart,
      window_end: windowEnd,
      quests,
      progress,
    };
  }

  /**
   * Toggles quest completion for a quest owned by `userId`.
   * Checking awards XP; undoing reverses it — same transaction (Issue #11).
   */
  async function toggleQuestCompletion(
    userId: number,
    questId: number,
    completed: boolean,
  ): Promise<ToggleQuestCompletionResponse> {
    const existing = await deps.quests.findByIdForUser(userId, questId);
    if (!existing) {
      throw notFound('Quest not found.');
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
      throw notFound('Quest not found.');
    }

    const leveledUp = completed && result.progress.level > result.previousLevel;
    return completionPayload(result.quest, result.progress, leveledUp);
  }

  return {
    getCurrentMilestoneQuests,
    generateCurrentMilestoneQuests,
    toggleQuestCompletion,
  };
}

export type QuestService = ReturnType<typeof createQuestService>;
