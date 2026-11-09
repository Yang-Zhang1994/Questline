import type {
  ConfirmWeekPlanResponse,
  WeekPlanDraft,
  WeekPlanResponse,
} from '@questline/shared';
import type { ChatAiClient } from '../ai/client.js';
import { resolveDailyBudget } from '../ai/prompts/mochiQuestPlan.js';
import {
  findWeekPlanBudgetOverflow,
  findWeekPlanDuplicate,
  weekWindow,
} from '../ai/prompts/mochiWeekPlan.js';
import type { Clock } from '../clock.js';
import { formatLocalDate } from '../clock.js';
import type { QuestRepository } from '../repositories/questRepository.js';
import { aiUnavailable, notFound, validationError } from './errors.js';

export type WeekPlanServiceDeps = {
  quests: QuestRepository;
  ai: ChatAiClient;
  clock: Clock;
};

function sortDraft(draft: WeekPlanDraft): WeekPlanDraft {
  const quests = [...draft.quests].sort(
    (a, b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title),
  );
  return { ...draft, quests };
}

function assertValidDraft(
  draft: WeekPlanDraft,
  existingQuests: Parameters<typeof findWeekPlanBudgetOverflow>[1],
  dailyBudget: number,
  today: string,
): void {
  if (draft.quests.length < 1) {
    throw validationError('Mochi needs at least one tiny quest for the week ♡');
  }

  if (draft.week_start < today) {
    throw validationError('Week plans should start today or later ♡');
  }
  if (draft.week_end < draft.week_start) {
    throw validationError('Week end should be on or after week start ♡');
  }

  for (const item of draft.quests) {
    if (!item.title.trim() || !item.due_date || !(item.estimated_minutes > 0)) {
      throw validationError('Each quest needs a title, due date, and estimated duration ♡');
    }
    if (item.due_date < draft.week_start || item.due_date > draft.week_end) {
      throw validationError('Each quest should land inside the week window ♡');
    }
  }

  const duplicate = findWeekPlanDuplicate(draft, existingQuests);
  if (duplicate) {
    throw validationError(
      `That quest is already on the calendar — let's pick a fresh title instead of "${duplicate}" ♡`,
    );
  }

  const overflow = findWeekPlanBudgetOverflow(draft, existingQuests, dailyBudget);
  if (overflow) {
    throw validationError(
      `Quests on ${overflow} go over your ${dailyBudget}-minute daily budget — let's spread them a little ♡`,
    );
  }
}

export function createWeekPlanService(deps: WeekPlanServiceDeps) {
  async function requireContext(userId: number, localDate?: string) {
    const today = localDate ?? formatLocalDate(deps.clock.now());
    const record = await deps.quests.findWeekPlanContext(userId, today);
    if (!record) {
      throw notFound(
        'Confirm a goal and milestone map first — then we can sketch a week of quests ♡',
      );
    }
    return { record, today };
  }

  async function getPlan(userId: number, localDate?: string): Promise<WeekPlanResponse> {
    const today = localDate ?? formatLocalDate(deps.clock.now());
    const record = await deps.quests.findWeekPlanContext(userId, today);
    if (!record) {
      return {
        draft: null,
        existing_quests: [],
        goal: null,
        milestone: null,
        applied: false,
      };
    }
    return {
      draft: record.draft,
      existing_quests: record.existingQuests,
      goal: record.goal,
      milestone: record.milestone,
      applied: false,
    };
  }

  async function proposePlan(
    userId: number,
    localDate?: string,
  ): Promise<WeekPlanResponse> {
    const { record, today } = await requireContext(userId, localDate);

    if (record.draft) {
      return {
        draft: record.draft,
        existing_quests: record.existingQuests,
        goal: record.goal,
        milestone: record.milestone,
        applied: false,
      };
    }

    const { weekStart, weekEnd } = weekWindow(today);
    let draft: WeekPlanDraft;
    try {
      draft = sortDraft(
        await deps.ai.proposeWeekPlan({
          goal: record.goal,
          milestone: record.milestone,
          existingQuests: record.existingQuests,
          today,
          weekStart,
          weekEnd,
        }),
      );
    } catch {
      throw aiUnavailable();
    }

    assertValidDraft(
      draft,
      record.existingQuests,
      resolveDailyBudget(record.goal),
      today,
    );

    await deps.quests.saveWeekPlanDraft(record.goal.id, userId, draft);

    return {
      draft,
      existing_quests: record.existingQuests,
      goal: record.goal,
      milestone: record.milestone,
      applied: false,
    };
  }

  async function revisePlan(
    userId: number,
    feedback?: string,
    localDate?: string,
  ): Promise<WeekPlanResponse> {
    const { record, today } = await requireContext(userId, localDate);
    if (!record.draft) {
      throw validationError('Ask Mochi for a week plan first, then we can tweak it ♡');
    }

    const { weekStart, weekEnd } = weekWindow(today);
    let draft: WeekPlanDraft;
    try {
      draft = sortDraft(
        await deps.ai.reviseWeekPlan({
          goal: record.goal,
          milestone: record.milestone,
          existingQuests: record.existingQuests,
          previous: record.draft,
          feedback,
          today,
          weekStart,
          weekEnd,
        }),
      );
    } catch {
      throw aiUnavailable();
    }

    assertValidDraft(
      draft,
      record.existingQuests,
      resolveDailyBudget(record.goal),
      today,
    );

    await deps.quests.saveWeekPlanDraft(record.goal.id, userId, draft);

    return {
      draft,
      existing_quests: record.existingQuests,
      goal: record.goal,
      milestone: record.milestone,
      applied: false,
    };
  }

  async function confirmPlan(
    userId: number,
    draft: WeekPlanDraft,
    localDate?: string,
  ): Promise<ConfirmWeekPlanResponse> {
    const { record, today } = await requireContext(userId, localDate);
    const normalized = sortDraft(draft);

    assertValidDraft(
      normalized,
      record.existingQuests,
      resolveDailyBudget(record.goal),
      today,
    );

    // Confirm-before-save: only path that INSERTs new quest rows.
    const quests = await deps.quests.applyWeekPlanDraft(
      record.goal.id,
      record.milestone.id,
      userId,
      normalized,
    );

    return {
      goal: record.goal,
      milestone: record.milestone,
      quests,
      mochi_message: normalized.mochi_message,
    };
  }

  return {
    getPlan,
    proposePlan,
    revisePlan,
    confirmPlan,
  };
}

export type WeekPlanService = ReturnType<typeof createWeekPlanService>;
