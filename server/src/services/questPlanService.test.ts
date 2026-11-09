import { describe, expect, it, vi } from 'vitest';
import type {
  Milestone,
  MilestoneGoalSummary,
  Quest,
  QuestPlanDraft,
} from '@questline/shared';
import type { Clock } from '../clock.js';
import { stubAi } from '../test/aiStub.js';
import { AppError } from './errors.js';
import { createQuestPlanService } from './questPlanService.js';

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

const sampleMilestone: Milestone = {
  id: 100,
  goal_id: 10,
  position: 1,
  title: 'Build a tiny daily reading habit',
  description: 'Read a few pages each day',
  target_date: '2026-11-16',
  status: 'current',
};

const sampleDraft: QuestPlanDraft = {
  quests: [
    { title: 'Read 2 pages', due_date: '2026-11-09', estimated_minutes: 10 },
    { title: 'Write 3 new words', due_date: '2026-11-09', estimated_minutes: 10 },
    { title: 'Read 2 more pages', due_date: '2026-11-10', estimated_minutes: 15 },
  ],
  mochi_message: 'Tiny quests for your reading habit ♡',
};

describe('questPlanService (Issue #7)', () => {
  const clock = fixedClock('2026-11-09T15:00:00.000Z');

  function buildRepo(initial?: {
    goal?: MilestoneGoalSummary | null;
    milestone?: Milestone | null;
    draft?: QuestPlanDraft | null;
    saved?: Quest[];
  }) {
    const goal = initial?.goal === undefined ? sampleGoal : initial.goal;
    const milestone = initial?.milestone === undefined ? sampleMilestone : initial.milestone;
    let draft = initial?.draft ?? null;
    let saved = [...(initial?.saved ?? [])];

    return {
      get state() {
        return { goal, milestone, draft, saved };
      },
      async findByIdForUser() {
        return null;
      },
      async listDueOnDateForActiveGoal() {
        return { goalTitle: null, milestoneTitle: null, quests: [] };
      },
      async listOverdueForActiveGoal() {
        return [];
      },
      async findRescheduleContext() {
        return null;
      },
      async saveRescheduleDraft() {
        /* unused in quest-plan unit tests */
      },
      async applyRescheduleDraft() {
        return [];
      },
      async findWeekPlanContext() {
        return null;
      },
      async saveWeekPlanDraft() {
        /* unused in quest-plan unit tests */
      },
      async applyWeekPlanDraft() {
        return [];
      },
      async setCompletedAtForUser() {
        return null;
      },
      async setCompletionWithXp() {
        return null;
      },
      async findCurrentMilestoneQuestContext(userId: number) {
        if (!goal || !milestone || userId !== 1) return null;
        return { goal, milestone, draft, quests: saved };
      },
      async saveQuestDraft(milestoneId: number, userId: number, next: QuestPlanDraft | null) {
        expect(milestoneId).toBe(milestone?.id);
        expect(userId).toBe(1);
        draft = next;
      },
      async confirmQuestPlan(milestoneId: number, userId: number, plan: QuestPlanDraft) {
        expect(milestoneId).toBe(milestone?.id);
        expect(userId).toBe(1);
        draft = null;
        saved = plan.quests.map((item, index) => ({
          id: index + 1,
          milestone_id: milestoneId,
          title: item.title,
          due_date: item.due_date,
          estimated_minutes: item.estimated_minutes,
          completed_at: null,
        }));
        return saved;
      },
    };
  }

  it('returns empty plan when the user has no current milestone', async () => {
    const quests = buildRepo({ goal: null, milestone: null });
    const service = createQuestPlanService({
      quests,
      ai: stubAi(),
      clock,
    });
    await expect(service.getPlan(1)).resolves.toEqual({
      draft: null,
      confirmed: false,
      goal: null,
      milestone: null,
      quests: [],
    });
  });

  // AC: Quests are generated for the current milestone only
  it('proposes a draft for the current milestone without writing quests', async () => {
    const quests = buildRepo({ saved: [] });
    const proposeQuestPlan = vi.fn(async () => sampleDraft);
    const service = createQuestPlanService({
      quests,
      ai: stubAi({ proposeQuestPlan }),
      clock,
    });

    const result = await service.proposePlan(1);
    expect(result.draft?.quests).toHaveLength(3);
    expect(result.milestone?.id).toBe(sampleMilestone.id);
    expect(result.confirmed).toBe(false);
    expect(result.quests).toEqual([]);
    expect(proposeQuestPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        milestone: expect.objectContaining({ id: sampleMilestone.id, status: 'current' }),
      }),
    );
    expect(quests.state.draft).toEqual(sampleDraft);
    expect(quests.state.saved).toHaveLength(0);
  });

  // AC: Quests are saved and not regenerated on every page load
  it('returns saved quests without calling AI when already confirmed', async () => {
    const saved: Quest[] = [
      {
        id: 1,
        milestone_id: 100,
        title: 'Read 2 pages',
        due_date: '2026-11-09',
        estimated_minutes: 10,
        completed_at: null,
      },
    ];
    const quests = buildRepo({ saved });
    const proposeQuestPlan = vi.fn(async () => sampleDraft);
    const service = createQuestPlanService({
      quests,
      ai: stubAi({ proposeQuestPlan }),
      clock,
    });

    const result = await service.proposePlan(1);
    expect(result.confirmed).toBe(true);
    expect(result.draft).toBeNull();
    expect(result.quests).toEqual(saved);
    expect(proposeQuestPlan).not.toHaveBeenCalled();
  });

  // AC: each day's quests fit within the user's daily time budget
  it('rejects a draft whose day exceeds the time budget', async () => {
    const quests = buildRepo({ saved: [] });
    const service = createQuestPlanService({
      quests,
      ai: stubAi({
        proposeQuestPlan: vi.fn(async () => ({
          quests: [
            { title: 'A', due_date: '2026-11-09', estimated_minutes: 15 },
            { title: 'B', due_date: '2026-11-09', estimated_minutes: 15 },
          ],
          mochi_message: 'oops',
        })),
      }),
      clock,
    });

    await expect(service.proposePlan(1)).rejects.toBeInstanceOf(AppError);
    await expect(service.proposePlan(1)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  // AC: each quest has title, due date, estimated duration; confirm persists
  it('confirms a draft and persists quests with title, due date, duration', async () => {
    const quests = buildRepo({ draft: sampleDraft, saved: [] });
    const service = createQuestPlanService({
      quests,
      ai: stubAi(),
      clock,
    });

    const result = await service.confirmPlan(1, sampleDraft);
    expect(result.quests).toHaveLength(3);
    for (const quest of result.quests) {
      expect(quest.title.length).toBeGreaterThan(0);
      expect(quest.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(quest.estimated_minutes).toBeGreaterThan(0);
      expect(quest.milestone_id).toBe(sampleMilestone.id);
    }
    expect(quests.state.draft).toBeNull();
    expect(quests.state.saved).toHaveLength(3);
  });
});
