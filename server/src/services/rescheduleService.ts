import type {
  ConfirmRescheduleResponse,
  RescheduleDraft,
  RescheduleResponse,
} from '@questline/shared';
import type { ChatAiClient } from '../ai/client.js';
import { resolveDailyBudget } from '../ai/prompts/mochiQuestPlan.js';
import { findRescheduleBudgetOverflow } from '../ai/prompts/mochiReschedule.js';
import type { Clock } from '../clock.js';
import { formatLocalDate } from '../clock.js';
import type { QuestRepository } from '../repositories/questRepository.js';
import { aiUnavailable, notFound, validationError } from './errors.js';

export type RescheduleServiceDeps = {
  quests: QuestRepository;
  ai: ChatAiClient;
  clock: Clock;
};

function sortDraft(draft: RescheduleDraft): RescheduleDraft {
  const moves = [...draft.moves].sort(
    (a, b) => a.to_date.localeCompare(b.to_date) || a.quest_id - b.quest_id,
  );
  return { ...draft, moves };
}

function assertValidDraft(
  draft: RescheduleDraft,
  overdueIds: Set<number>,
  allQuests: Parameters<typeof findRescheduleBudgetOverflow>[1],
  dailyBudget: number,
  today: string,
): void {
  if (draft.moves.length < 1) {
    throw validationError('Mochi needs at least one overdue quest to reshuffle ♡');
  }

  const seen = new Set<number>();
  for (const move of draft.moves) {
    if (!overdueIds.has(move.quest_id)) {
      throw validationError('Reschedule can only move overdue quests that still need love ♡');
    }
    if (seen.has(move.quest_id)) {
      throw validationError('Each overdue quest should appear once in the preview ♡');
    }
    seen.add(move.quest_id);
    if (move.to_date < today) {
      throw validationError('New dates should be today or later — soft steps forward ♡');
    }
  }

  for (const id of overdueIds) {
    if (!seen.has(id)) {
      throw validationError('Every overdue quest should get a new date in the preview ♡');
    }
  }

  const overflow = findRescheduleBudgetOverflow(draft, allQuests, dailyBudget);
  if (overflow) {
    throw validationError(
      `Quests on ${overflow} go over your ${dailyBudget}-minute daily budget — let's spread them a little ♡`,
    );
  }
}

export function createRescheduleService(deps: RescheduleServiceDeps) {
  async function requireContext(userId: number, localDate?: string) {
    const today = localDate ?? formatLocalDate(deps.clock.now());
    const record = await deps.quests.findRescheduleContext(userId, today);
    if (!record) {
      throw notFound(
        'Confirm a goal and milestone map first — then we can adjust overdue quests ♡',
      );
    }
    return { record, today };
  }

  async function getPlan(userId: number, localDate?: string): Promise<RescheduleResponse> {
    const today = localDate ?? formatLocalDate(deps.clock.now());
    const record = await deps.quests.findRescheduleContext(userId, today);
    if (!record) {
      return {
        draft: null,
        overdue: [],
        goal: null,
        milestone: null,
        applied: false,
      };
    }
    return {
      draft: record.draft,
      overdue: record.overdue,
      goal: record.goal,
      milestone: record.milestone,
      applied: false,
    };
  }

  async function proposePlan(
    userId: number,
    localDate?: string,
  ): Promise<RescheduleResponse> {
    const { record, today } = await requireContext(userId, localDate);

    if (record.draft) {
      return {
        draft: record.draft,
        overdue: record.overdue,
        goal: record.goal,
        milestone: record.milestone,
        applied: false,
      };
    }

    if (record.overdue.length === 0) {
      return {
        draft: null,
        overdue: [],
        goal: record.goal,
        milestone: record.milestone,
        applied: false,
      };
    }

    let draft: RescheduleDraft;
    try {
      draft = sortDraft(
        await deps.ai.proposeReschedule({
          goal: record.goal,
          milestone: record.milestone,
          overdue: record.overdue,
          allQuests: record.allQuests,
          today,
        }),
      );
    } catch {
      throw aiUnavailable();
    }

    assertValidDraft(
      draft,
      new Set(record.overdue.map((q) => q.id)),
      record.allQuests,
      resolveDailyBudget(record.goal),
      today,
    );

    await deps.quests.saveRescheduleDraft(record.goal.id, userId, draft);

    return {
      draft,
      overdue: record.overdue,
      goal: record.goal,
      milestone: record.milestone,
      applied: false,
    };
  }

  async function revisePlan(
    userId: number,
    feedback?: string,
    localDate?: string,
  ): Promise<RescheduleResponse> {
    const { record, today } = await requireContext(userId, localDate);
    if (!record.draft) {
      throw validationError('Ask Mochi to reshuffle first, then we can tweak the dates ♡');
    }
    if (record.overdue.length === 0) {
      throw validationError('Nothing overdue right now — enjoy the clear path ♡');
    }

    let draft: RescheduleDraft;
    try {
      draft = sortDraft(
        await deps.ai.reviseReschedule({
          goal: record.goal,
          milestone: record.milestone,
          overdue: record.overdue,
          allQuests: record.allQuests,
          previous: record.draft,
          feedback,
          today,
        }),
      );
    } catch {
      throw aiUnavailable();
    }

    assertValidDraft(
      draft,
      new Set(record.overdue.map((q) => q.id)),
      record.allQuests,
      resolveDailyBudget(record.goal),
      today,
    );

    await deps.quests.saveRescheduleDraft(record.goal.id, userId, draft);

    return {
      draft,
      overdue: record.overdue,
      goal: record.goal,
      milestone: record.milestone,
      applied: false,
    };
  }

  async function confirmPlan(
    userId: number,
    draft: RescheduleDraft,
    localDate?: string,
  ): Promise<ConfirmRescheduleResponse> {
    const { record, today } = await requireContext(userId, localDate);
    const normalized = sortDraft(draft);

    if (record.overdue.length === 0) {
      throw validationError('Nothing overdue to reshape right now ♡');
    }

    assertValidDraft(
      normalized,
      new Set(record.overdue.map((q) => q.id)),
      record.allQuests,
      resolveDailyBudget(record.goal),
      today,
    );

    // Confirm-before-save: only path that UPDATEs quest due_dates.
    const quests = await deps.quests.applyRescheduleDraft(
      record.goal.id,
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

export type RescheduleService = ReturnType<typeof createRescheduleService>;
