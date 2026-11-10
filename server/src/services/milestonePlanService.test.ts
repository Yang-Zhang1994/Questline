import { describe, expect, it, vi } from 'vitest';
import type { Milestone, MilestoneGoalSummary, MilestonePlanDraft } from '@questline/shared';
import type { ChatAiClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import { stubAi } from '../test/aiStub.js';
import { AppError } from './errors.js';
import { createMilestonePlanService } from './milestonePlanService.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

const sampleGoal: MilestoneGoalSummary = {
  id: 10,
  title: 'Read a Japanese novel on my own',
  done_definition: 'Finish one short Japanese novel',
  starting_point: 'Know hiragana',
  time_budget_minutes_per_day: 20,
  deadline: '2027-11-09',
};

const sampleDraft: MilestonePlanDraft = {
  milestones: [
    {
      position: 1,
      title: 'Tiny habit',
      description: 'Read a little each day',
      target_date: '2026-12-01',
    },
    {
      position: 2,
      title: 'Comfort basics',
      description: 'Build vocabulary gently',
      target_date: '2027-03-01',
    },
    {
      position: 3,
      title: 'Stretch practice',
      description: 'Try short stories',
      target_date: '2027-07-01',
    },
    {
      position: 4,
      title: 'Finish the novel',
      description: 'Complete the goal',
      target_date: '2027-11-01',
    },
  ],
  mochi_message: 'Here is a cozy 4-stage map ♡',
};

describe('milestonePlanService (Issue #5)', () => {
  const clock = fixedClock('2026-11-09T15:00:00.000Z');

  function buildRepo(initial?: {
    goal?: MilestoneGoalSummary | null;
    draft?: MilestonePlanDraft | null;
    saved?: Milestone[];
  }) {
    const goal = initial?.goal === undefined ? sampleGoal : initial.goal;
    let draft = initial?.draft ?? null;
    let saved = [...(initial?.saved ?? [])];

    return {
      get state() {
        return { goal, draft, saved };
      },
      async findActiveGoalPlan(userId: number) {
        if (!goal || userId !== 1) return null;
        return { goal, draft };
      },
      async findGoalPlanForMap(userId: number) {
        if (!goal || userId !== 1) return null;
        return { goal, draft };
      },
      async saveDraft(goalId: number, userId: number, next: MilestonePlanDraft | null) {
        expect(goalId).toBe(goal?.id);
        expect(userId).toBe(1);
        draft = next;
      },
      async listForGoal(goalId: number) {
        expect(goalId).toBe(goal?.id);
        return saved;
      },
      async confirmPlan(goalId: number, userId: number, plan: MilestonePlanDraft) {
        expect(goalId).toBe(goal?.id);
        expect(userId).toBe(1);
        draft = null;
        saved = plan.milestones.map((item, index) => ({
          id: index + 1,
          goal_id: goalId,
          position: item.position,
          title: item.title,
          description: item.description,
          target_date: item.target_date,
          status: item.position === 1 ? ('current' as const) : ('upcoming' as const),
        }));
        return saved;
      },
      async completeCurrentAndAdvance() {
        throw new Error('not used in plan service tests');
      },
    };
  }

  it('returns empty plan when the user has no active goal', async () => {
    const milestones = buildRepo({ goal: null });
    const ai = stubAi();
    const service = createMilestonePlanService({ milestones, ai, clock });

    await expect(service.getPlan(1)).resolves.toEqual({
      draft: null,
      confirmed: false,
      goal: null,
      milestones: [],
    });
  });

  it('rejects propose when there is no active goal', async () => {
    const milestones = buildRepo({ goal: null });
    const proposeMilestonePlan = vi.fn();
    const ai = stubAi({ proposeMilestonePlan });
    const service = createMilestonePlanService({ milestones, ai, clock });

    await expect(service.proposePlan(1)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<AppError>);
    expect(proposeMilestonePlan).not.toHaveBeenCalled();
  });

  // AC: Mochi proposes 3–7 ordered milestones based on confirmed goal
  it('proposes a draft without writing milestone rows', async () => {
    const milestones = buildRepo();
    const proposeMilestonePlan = vi.fn(async () => sampleDraft);
    const ai: ChatAiClient = stubAi({ proposeMilestonePlan });
    const service = createMilestonePlanService({ milestones, ai, clock });

    const result = await service.proposePlan(1);

    expect(result.draft?.milestones).toHaveLength(4);
    expect(result.confirmed).toBe(false);
    expect(result.milestones).toEqual([]);
    expect(milestones.state.draft).toEqual(sampleDraft);
    expect(proposeMilestonePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: sampleGoal,
        today: '2026-11-09',
      }),
    );
  });

  it('treats an existing saved plan as confirmed and skips AI', async () => {
    const saved: Milestone[] = sampleDraft.milestones.map((item, index) => ({
      id: index + 1,
      goal_id: sampleGoal.id,
      position: item.position,
      title: item.title,
      description: item.description,
      target_date: item.target_date,
      status: item.position === 1 ? ('current' as const) : ('upcoming' as const),
    }));
    const milestones = buildRepo({ saved });
    const proposeMilestonePlan = vi.fn();
    const ai = stubAi({ proposeMilestonePlan });
    const service = createMilestonePlanService({ milestones, ai, clock });

    const result = await service.proposePlan(1);
    expect(result.confirmed).toBe(true);
    expect(result.draft).toBeNull();
    expect(result.milestones).toHaveLength(4);
    expect(proposeMilestonePlan).not.toHaveBeenCalled();
  });

  // AC: user can ask Mochi to add/remove/rename/reorder before agreeing
  it('revises a draft via Mochi feedback without saving rows', async () => {
    const revised: MilestonePlanDraft = {
      ...sampleDraft,
      milestones: [
        ...sampleDraft.milestones,
        {
          position: 5,
          title: 'Bonus polish',
          description: 'Extra gentle stage',
          target_date: '2027-11-05',
        },
      ],
      mochi_message: 'Added a polish stage ♡',
    };
    const milestones = buildRepo({ draft: sampleDraft });
    const reviseMilestonePlan = vi.fn(async () => revised);
    const ai = stubAi({ reviseMilestonePlan });
    const service = createMilestonePlanService({ milestones, ai, clock });

    const result = await service.revisePlan(1, 'Please add one more stage');
    expect(result.draft?.milestones).toHaveLength(5);
    expect(result.confirmed).toBe(false);
    expect(milestones.state.saved).toEqual([]);
    expect(reviseMilestonePlan).toHaveBeenCalledWith(
      expect.objectContaining({ feedback: 'Please add one more stage' }),
    );
  });

  // AC: milestones are saved only after the user confirms the plan
  it('writes milestones only on confirm and clears the draft', async () => {
    const milestones = buildRepo({ draft: sampleDraft });
    const ai = stubAi({
      proposeMilestonePlan: vi.fn(),
      reviseMilestonePlan: vi.fn(),
    });
    const service = createMilestonePlanService({ milestones, ai, clock });

    const result = await service.confirmPlan(1, sampleDraft);
    expect(result.milestones).toHaveLength(4);
    expect(result.milestones[0]?.status).toBe('current');
    expect(result.milestones[1]?.status).toBe('upcoming');
    expect(milestones.state.draft).toBeNull();
    expect(milestones.state.saved).toHaveLength(4);
  });

  it('rejects confirm when a target date is after the goal deadline', async () => {
    const bad: MilestonePlanDraft = {
      ...sampleDraft,
      milestones: sampleDraft.milestones.map((item, index) =>
        index === 3 ? { ...item, target_date: '2028-01-01' } : item,
      ),
    };
    const milestones = buildRepo({ draft: sampleDraft });
    const service = createMilestonePlanService({ milestones, ai: stubAi(), clock });

    await expect(service.confirmPlan(1, bad)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(milestones.state.saved).toEqual([]);
  });
});
