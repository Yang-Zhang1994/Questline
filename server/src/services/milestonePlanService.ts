import type {
  ConfirmMilestonePlanResponse,
  MilestonePlanDraft,
  MilestonePlanResponse,
} from '@questline/shared';
import type { ChatAiClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import { formatLocalDate } from '../clock.js';
import type { MilestoneRepository } from '../repositories/milestoneRepository.js';
import { aiUnavailable, notFound, validationError } from './errors.js';

export type MilestonePlanServiceDeps = {
  milestones: MilestoneRepository;
  ai: ChatAiClient;
  clock: Clock;
};

function sortDraft(draft: MilestonePlanDraft): MilestonePlanDraft {
  const milestones = [...draft.milestones]
    .sort((a, b) => a.position - b.position || a.target_date.localeCompare(b.target_date))
    .map((item, index) => ({ ...item, position: index + 1 }));
  return { ...draft, milestones };
}

export function createMilestonePlanService(deps: MilestonePlanServiceDeps) {
  async function requireActiveGoal(userId: number) {
    const record = await deps.milestones.findActiveGoalPlan(userId);
    if (!record) {
      throw notFound(
        'Confirm a goal with Mochi first — then we can draw your milestone map ♡',
      );
    }
    return record;
  }

  async function getPlan(userId: number): Promise<MilestonePlanResponse> {
    // Map may show a completed goal after the final stage clears (#10).
    const record = await deps.milestones.findGoalPlanForMap(userId);
    if (!record) {
      return { draft: null, confirmed: false, goal: null, milestones: [] };
    }
    const saved = await deps.milestones.listForGoal(record.goal.id);
    if (record.draft) {
      return {
        draft: record.draft,
        confirmed: false,
        goal: record.goal,
        milestones: saved,
      };
    }
    return {
      draft: null,
      confirmed: saved.length > 0,
      goal: record.goal,
      milestones: saved,
    };
  }

  async function proposePlan(userId: number): Promise<MilestonePlanResponse> {
    const record = await requireActiveGoal(userId);
    const saved = await deps.milestones.listForGoal(record.goal.id);

    if (record.draft) {
      return {
        draft: record.draft,
        confirmed: false,
        goal: record.goal,
        milestones: saved,
      };
    }

    // Already confirmed (or seeded) — do not invent a competing draft.
    if (saved.length > 0) {
      return {
        draft: null,
        confirmed: true,
        goal: record.goal,
        milestones: saved,
      };
    }

    const today = formatLocalDate(deps.clock.now());
    let draft: MilestonePlanDraft;
    try {
      draft = sortDraft(
        await deps.ai.proposeMilestonePlan({ goal: record.goal, today }),
      );
    } catch {
      throw aiUnavailable();
    }

    if (draft.milestones.length < 3 || draft.milestones.length > 7) {
      throw validationError('Mochi needs between 3 and 7 milestones for a cozy map ♡');
    }

    await deps.milestones.saveDraft(record.goal.id, userId, draft);

    return {
      draft,
      confirmed: false,
      goal: record.goal,
      milestones: [],
    };
  }

  async function revisePlan(
    userId: number,
    feedback?: string,
  ): Promise<MilestonePlanResponse> {
    const record = await requireActiveGoal(userId);
    if (!record.draft) {
      throw validationError('Ask Mochi for a milestone map first, then we can tweak it ♡');
    }

    const today = formatLocalDate(deps.clock.now());
    let draft: MilestonePlanDraft;
    try {
      draft = sortDraft(
        await deps.ai.reviseMilestonePlan({
          goal: record.goal,
          previous: record.draft,
          feedback,
          today,
        }),
      );
    } catch {
      throw aiUnavailable();
    }

    if (draft.milestones.length < 3 || draft.milestones.length > 7) {
      throw validationError('Keep between 3 and 7 milestones so the map stays clear ♡');
    }

    // Soft guard: every target date should be on/before deadline when deadline is ISO.
    const deadline = record.goal.deadline?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
    if (deadline) {
      for (const item of draft.milestones) {
        if (item.target_date > deadline) {
          throw validationError(
            'Each milestone needs a target date on or before your goal deadline ♡',
          );
        }
      }
    }

    await deps.milestones.saveDraft(record.goal.id, userId, draft);
    const saved = await deps.milestones.listForGoal(record.goal.id);

    return {
      draft,
      confirmed: false,
      goal: record.goal,
      milestones: saved,
    };
  }

  async function confirmPlan(
    userId: number,
    draft: MilestonePlanDraft,
  ): Promise<ConfirmMilestonePlanResponse> {
    const record = await requireActiveGoal(userId);
    const normalized = sortDraft(draft);

    if (normalized.milestones.length < 3 || normalized.milestones.length > 7) {
      throw validationError('A confirmed plan needs between 3 and 7 milestones ♡');
    }

    const deadline = record.goal.deadline?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
    if (deadline) {
      for (const item of normalized.milestones) {
        if (item.target_date > deadline) {
          throw validationError(
            'Each milestone needs a target date on or before your goal deadline ♡',
          );
        }
      }
    }

    // Confirm-before-save: only persist milestone rows when the client Accepts.
    const milestones = await deps.milestones.confirmPlan(
      record.goal.id,
      userId,
      normalized,
    );

    return { goal: record.goal, milestones };
  }

  return {
    getPlan,
    proposePlan,
    revisePlan,
    confirmPlan,
  };
}

export type MilestonePlanService = ReturnType<typeof createMilestonePlanService>;
