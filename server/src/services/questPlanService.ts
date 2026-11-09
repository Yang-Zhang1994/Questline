import type {
  ConfirmQuestPlanResponse,
  QuestPlanDraft,
  QuestPlanResponse,
} from '@questline/shared';
import type { ChatAiClient } from '../ai/client.js';
import {
  findBudgetOverflow,
  resolveDailyBudget,
} from '../ai/prompts/mochiQuestPlan.js';
import type { Clock } from '../clock.js';
import { formatLocalDate } from '../clock.js';
import type { QuestRepository } from '../repositories/questRepository.js';
import { aiUnavailable, notFound, validationError } from './errors.js';

export type QuestPlanServiceDeps = {
  quests: QuestRepository;
  ai: ChatAiClient;
  clock: Clock;
};

function sortDraft(draft: QuestPlanDraft): QuestPlanDraft {
  const quests = [...draft.quests].sort(
    (a, b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title),
  );
  return { ...draft, quests };
}

function assertFitsBudget(draft: QuestPlanDraft, dailyBudget: number): void {
  const overflowDay = findBudgetOverflow(draft, dailyBudget);
  if (overflowDay) {
    throw validationError(
      `Quests on ${overflowDay} go over your ${dailyBudget}-minute daily budget — let's trim a little ♡`,
    );
  }
}

export function createQuestPlanService(deps: QuestPlanServiceDeps) {
  async function requireCurrentMilestone(userId: number) {
    const record = await deps.quests.findCurrentMilestoneQuestContext(userId);
    if (!record) {
      throw notFound(
        'Confirm a milestone map with Mochi first — then we can sketch daily quests ♡',
      );
    }
    return record;
  }

  async function getPlan(userId: number): Promise<QuestPlanResponse> {
    const record = await deps.quests.findCurrentMilestoneQuestContext(userId);
    if (!record) {
      return { draft: null, confirmed: false, goal: null, milestone: null, quests: [] };
    }
    if (record.draft) {
      return {
        draft: record.draft,
        confirmed: false,
        goal: record.goal,
        milestone: record.milestone,
        quests: record.quests,
      };
    }
    return {
      draft: null,
      confirmed: record.quests.length > 0,
      goal: record.goal,
      milestone: record.milestone,
      quests: record.quests,
    };
  }

  async function proposePlan(userId: number): Promise<QuestPlanResponse> {
    const record = await requireCurrentMilestone(userId);

    if (record.draft) {
      return {
        draft: record.draft,
        confirmed: false,
        goal: record.goal,
        milestone: record.milestone,
        quests: record.quests,
      };
    }

    // Already confirmed (or seeded) — do not invent a competing draft (AC: not regenerated).
    if (record.quests.length > 0) {
      return {
        draft: null,
        confirmed: true,
        goal: record.goal,
        milestone: record.milestone,
        quests: record.quests,
      };
    }

    const today = formatLocalDate(deps.clock.now());
    let draft: QuestPlanDraft;
    try {
      draft = sortDraft(
        await deps.ai.proposeQuestPlan({
          goal: record.goal,
          milestone: record.milestone,
          today,
        }),
      );
    } catch {
      throw aiUnavailable();
    }

    if (draft.quests.length < 1) {
      throw validationError('Mochi needs at least one tiny quest to get started ♡');
    }

    assertFitsBudget(draft, resolveDailyBudget(record.goal));
    await deps.quests.saveQuestDraft(record.milestone.id, userId, draft);

    return {
      draft,
      confirmed: false,
      goal: record.goal,
      milestone: record.milestone,
      quests: [],
    };
  }

  async function revisePlan(
    userId: number,
    feedback?: string,
  ): Promise<QuestPlanResponse> {
    const record = await requireCurrentMilestone(userId);
    if (!record.draft) {
      throw validationError('Ask Mochi for a quest plan first, then we can tweak it ♡');
    }

    const today = formatLocalDate(deps.clock.now());
    let draft: QuestPlanDraft;
    try {
      draft = sortDraft(
        await deps.ai.reviseQuestPlan({
          goal: record.goal,
          milestone: record.milestone,
          previous: record.draft,
          feedback,
          today,
        }),
      );
    } catch {
      throw aiUnavailable();
    }

    if (draft.quests.length < 1) {
      throw validationError('Keep at least one tiny quest so today has a next step ♡');
    }

    assertFitsBudget(draft, resolveDailyBudget(record.goal));
    await deps.quests.saveQuestDraft(record.milestone.id, userId, draft);

    return {
      draft,
      confirmed: false,
      goal: record.goal,
      milestone: record.milestone,
      quests: record.quests,
    };
  }

  async function confirmPlan(
    userId: number,
    draft: QuestPlanDraft,
  ): Promise<ConfirmQuestPlanResponse> {
    const record = await requireCurrentMilestone(userId);
    const normalized = sortDraft(draft);

    if (normalized.quests.length < 1) {
      throw validationError('A confirmed plan needs at least one quest ♡');
    }

    for (const item of normalized.quests) {
      if (!item.title.trim() || !item.due_date || !(item.estimated_minutes > 0)) {
        throw validationError('Each quest needs a title, due date, and estimated duration ♡');
      }
    }

    assertFitsBudget(normalized, resolveDailyBudget(record.goal));

    // Confirm-before-save: only persist quest rows when the client Accepts.
    const quests = await deps.quests.confirmQuestPlan(
      record.milestone.id,
      userId,
      normalized,
    );

    return {
      goal: record.goal,
      milestone: record.milestone,
      quests,
    };
  }

  return {
    getPlan,
    proposePlan,
    revisePlan,
    confirmPlan,
  };
}

export type QuestPlanService = ReturnType<typeof createQuestPlanService>;
