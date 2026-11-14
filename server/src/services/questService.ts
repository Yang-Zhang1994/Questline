import {
  QuestGenerationAiResponseSchema,
  WeekPlanAiResponseSchema,
  createQuestProposalListSchema,
  type ChatMessage,
  type ConfirmWeekPlanResponse,
  type CurrentMilestoneQuestsResponse,
  type ProposeWeekPlanResponse,
  type ProposedQuest,
  type StageReadySummary,
  type StampCard,
  type ToggleQuestCompletionResponse,
  type UserProgress,
} from '@questline/shared';
import type { ChatAiClient, ClaudeChatTurn } from '../ai/client.js';
import {
  buildDefaultQuestProposal,
  buildDefaultWeekPlanProposal,
  computeQuestGenerationWindow,
  computeWeekPlanWindow,
} from '../ai/prompts/mochiQuests.js';
import type { Clock } from '../clock.js';
import { resolveClientLocalDate, toIsoDateTime } from '../clock.js';
import {
  DEFAULT_TIME_BUDGET_MINUTES,
  XP_PER_QUEST,
  cardCompletedMessage,
  levelUpMessage,
} from '../config/game.js';
import type { ChatRepository } from '../repositories/chatRepository.js';
import { mapGoalRowToRoadmapGoal } from '../repositories/goalRepository.js';
import type { ProgressRepository } from '../repositories/progressRepository.js';
import type { QuestRepository } from '../repositories/questRepository.js';
import { aiUnavailable, notFound, validationError } from './errors.js';

export type QuestServiceDeps = {
  quests: QuestRepository;
  progress: ProgressRepository;
  chat?: ChatRepository;
  ai: ChatAiClient;
  clock: Clock;
};

export type ProposeWeekPlanOptions = {
  local_date?: string;
  feedback?: string;
  current_draft?: ProposedQuest[];
};

export type ConfirmWeekPlanOptions = {
  local_date?: string;
  quests: ProposedQuest[];
};

function toClaudeHistory(messages: ChatMessage[]): ClaudeChatTurn[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'mochi')
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }));
}

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
  stampCard: StampCard,
  cardCompleted: boolean,
  completedCardNumber: number | null,
  stage: StageReadiness,
): ToggleQuestCompletionResponse {
  return {
    quest,
    progress,
    leveled_up: leveledUp,
    level_up_message: leveledUp ? levelUpMessage(progress.level) : null,
    stamp_card: stampCard,
    card_completed: cardCompleted,
    card_reward_message:
      cardCompleted && completedCardNumber !== null
        ? cardCompletedMessage(completedCardNumber)
        : null,
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
    const [progress, stampCard] = await Promise.all([
      deps.progress.getOrCreate(userId, today),
      deps.progress.getStampCard(userId),
    ]);

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
        stamp_card: stampCard,
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
      stamp_card: stampCard,
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
    const [progress, stampCard] = await Promise.all([
      deps.progress.getOrCreate(userId, today),
      deps.progress.getStampCard(userId),
    ]);

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
        stamp_card: stampCard,
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
      stamp_card: stampCard,
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
   * Checking awards XP + streak + stamp; undoing reverses them — same transaction (#11 / #12 / #13).
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

    // Idempotent no-ops: still return current progress + stamp card for the HUD.
    if (completed && existing.completed_at !== null) {
      const [progress, stampCard, stage] = await Promise.all([
        deps.progress.getOrCreate(userId, date),
        deps.progress.getStampCard(userId),
        stageReadiness(userId),
      ]);
      return completionPayload(existing, progress, false, stampCard, false, null, stage);
    }
    if (!completed && existing.completed_at === null) {
      const [progress, stampCard, stage] = await Promise.all([
        deps.progress.getOrCreate(userId, date),
        deps.progress.getStampCard(userId),
        stageReadiness(userId),
      ]);
      return completionPayload(existing, progress, false, stampCard, false, null, stage);
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
    return completionPayload(
      result.quest,
      result.progress,
      leveledUp,
      result.stampCard,
      result.cardCompleted,
      result.completedCardNumber,
      stage,
    );
  }

  /**
   * Proposes or adjusts the next 7 days of quests for the current milestone without saving
   * any quests to the database (Issue #15).
   */
  async function proposeWeekPlan(
    userId: number,
    options: ProposeWeekPlanOptions = {},
  ): Promise<ProposeWeekPlanResponse> {
    const today = resolveClientLocalDate(options.local_date, deps.clock);
    const { goal: rawGoal, milestone } = await deps.quests.getCurrentMilestoneContextForUser(userId);
    const goal = normalizeGoal(rawGoal);

    if (!goal) {
      throw notFound('Confirm a goal first before planning the week.');
    }
    if (!milestone) {
      throw notFound('Confirm a milestone plan with a current stage before planning the week.');
    }

    const { windowStart, windowEnd } = computeWeekPlanWindow(today, milestone.target_date);
    const timeBudgetMinutesPerDay =
      goal.time_budget_minutes_per_day && goal.time_budget_minutes_per_day > 0
        ? goal.time_budget_minutes_per_day
        : DEFAULT_TIME_BUDGET_MINUTES;

    const existingQuests = await deps.quests.listForMilestone(userId, milestone.id);
    const history = deps.chat ? toClaudeHistory(await deps.chat.listForUser(userId)) : [];

    const requestInput = {
      goal,
      milestone,
      windowStart,
      windowEnd,
      timeBudgetMinutesPerDay,
      existingQuests,
      history,
      current_draft: options.current_draft,
      feedback: options.feedback,
    };

    let rawProposal;
    try {
      rawProposal = deps.ai.proposeWeekPlan
        ? await deps.ai.proposeWeekPlan(requestInput)
        : buildDefaultWeekPlanProposal(requestInput);
    } catch {
      throw aiUnavailable();
    }

    const validationSchema = WeekPlanAiResponseSchema.extend({
      quests: createQuestProposalListSchema({
        windowStart,
        windowEnd,
        milestoneTargetDate: milestone.target_date,
        timeBudgetMinutesPerDay,
        existingQuests,
        enforceNoDuplicates: true,
      }),
    });

    const parsed = validationSchema.safeParse(rawProposal);
    if (!parsed.success) {
      throw aiUnavailable(
        'Mochi got a little tangled while sketching your weekly quest plan. Please try again in a moment.',
      );
    }

    const now = deps.clock.now();
    const userCreatedAt = toIsoDateTime(now);
    const mochiCreatedAt = toIsoDateTime(new Date(now.getTime() + 1000));
    const trimmedFeedback = options.feedback?.trim();

    if (deps.chat) {
      if (trimmedFeedback) {
        const pair = await deps.chat.insertPair(
          userId,
          trimmedFeedback,
          parsed.data.mochi_message,
          userCreatedAt,
          mochiCreatedAt,
          goal.id,
        );
        return {
          goal,
          milestone,
          window_start: windowStart,
          window_end: windowEnd,
          time_budget_minutes_per_day: timeBudgetMinutesPerDay,
          existing_quests: existingQuests,
          quests: parsed.data.quests,
          user_message: pair.userMessage,
          mochi_message: pair.mochiMessage,
        };
      }

      const mochiMessage = await deps.chat.insert(
        userId,
        'mochi',
        parsed.data.mochi_message,
        userCreatedAt,
        goal.id,
      );
      return {
        goal,
        milestone,
        window_start: windowStart,
        window_end: windowEnd,
        time_budget_minutes_per_day: timeBudgetMinutesPerDay,
        existing_quests: existingQuests,
        quests: parsed.data.quests,
        user_message: null,
        mochi_message: mochiMessage,
      };
    }

    return {
      goal,
      milestone,
      window_start: windowStart,
      window_end: windowEnd,
      time_budget_minutes_per_day: timeBudgetMinutesPerDay,
      existing_quests: existingQuests,
      quests: parsed.data.quests,
      user_message: trimmedFeedback
        ? {
            id: 1,
            user_id: userId,
            goal_id: goal.id,
            role: 'user',
            content: trimmedFeedback,
            created_at: userCreatedAt,
          }
        : null,
      mochi_message: {
        id: 2,
        user_id: userId,
        goal_id: goal.id,
        role: 'mochi',
        content: parsed.data.mochi_message,
        created_at: mochiCreatedAt,
      },
    };
  }

  /**
   * Re-validates and saves the accepted weekly quest plan in one locked transaction (Issue #15).
   * Preserves all existing quests and rejects duplicate submits.
   */
  async function confirmWeekPlan(
    userId: number,
    options: ConfirmWeekPlanOptions,
  ): Promise<ConfirmWeekPlanResponse> {
    const today = resolveClientLocalDate(options.local_date, deps.clock);
    const { goal: rawGoal, milestone } = await deps.quests.getCurrentMilestoneContextForUser(userId);
    const goal = normalizeGoal(rawGoal);

    if (!goal) {
      throw notFound('No active goal found to confirm a week plan for.');
    }
    if (!milestone) {
      throw notFound('No current milestone found to confirm a week plan for.');
    }

    const { windowStart, windowEnd } = computeWeekPlanWindow(today, milestone.target_date);
    const timeBudgetMinutesPerDay =
      goal.time_budget_minutes_per_day && goal.time_budget_minutes_per_day > 0
        ? goal.time_budget_minutes_per_day
        : DEFAULT_TIME_BUDGET_MINUTES;

    const existingQuests = await deps.quests.listForMilestone(userId, milestone.id);

    // 1. Validate format, window, target_date cut-off, daily budget (existing + proposed), and self-duplicates via Zod.
    // Note: if all proposed quests already exist on the milestone (e.g. a double-click or second tab confirming the same plan),
    // `saveConfirmedWeekPlanQuests` will catch the duplicate title under the row lock and throw 409 CONFLICT.
    // So we validate the proposed batch's own structure/window/self-duplicates first, then check daily budget against non-duplicate existing quests.
    const proposedNormalizedSet = new Set(
      options.quests.map((q) => (typeof q?.title === 'string' ? q.title.trim().toLowerCase() : '')),
    );
    const nonOverlappingExisting = existingQuests.filter(
      (q) => !proposedNormalizedSet.has(q.title.trim().toLowerCase()),
    );
    const listSchema = createQuestProposalListSchema({
      windowStart,
      windowEnd,
      milestoneTargetDate: milestone.target_date,
      timeBudgetMinutesPerDay,
      existingQuests: nonOverlappingExisting,
      enforceNoDuplicates: true,
    });

    const parsed = listSchema.safeParse(options.quests);
    if (!parsed.success) {
      const firstMessage = parsed.error.issues[0]?.message ?? 'Invalid weekly quest plan';
      throw validationError(firstMessage);
    }

    const savedQuests = await deps.quests.saveConfirmedWeekPlanQuests(
      userId,
      milestone.id,
      windowStart,
      windowEnd,
      timeBudgetMinutesPerDay,
      parsed.data,
    );

    const updatedMilestone = {
      ...milestone,
      total_quests: savedQuests.length,
      done_quests: savedQuests.filter((q) => q.completed_at !== null).length,
    };

    return {
      goal,
      milestone: updatedMilestone,
      window_start: windowStart,
      window_end: windowEnd,
      quests: savedQuests,
    };
  }

  return {
    getCurrentMilestoneQuests,
    generateCurrentMilestoneQuests,
    toggleQuestCompletion,
    proposeWeekPlan,
    confirmWeekPlan,
  };
}

export type QuestService = ReturnType<typeof createQuestService>;
