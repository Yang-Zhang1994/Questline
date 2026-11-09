import { describe, expect, it, vi } from 'vitest';
import type {
  Milestone,
  MilestoneGoalSummary,
  Quest,
  WeekPlanDraft,
} from '@questline/shared';
import type { ChatAiClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import type { QuestRepository } from '../repositories/questRepository.js';
import { createWeekPlanService } from './weekPlanService.js';

const goal: MilestoneGoalSummary = {
  id: 1,
  title: 'Goal',
  done_definition: null,
  starting_point: null,
  time_budget_minutes_per_day: 20,
  deadline: null,
};

const milestone: Milestone = {
  id: 2,
  goal_id: 1,
  position: 1,
  title: 'Stage',
  description: null,
  target_date: '2026-11-16',
  status: 'current',
};

const existing: Quest[] = [
  {
    id: 10,
    milestone_id: 2,
    title: 'Existing A',
    due_date: '2026-11-09',
    estimated_minutes: 10,
    completed_at: null,
  },
];

const draft: WeekPlanDraft = {
  week_start: '2026-11-09',
  week_end: '2026-11-15',
  quests: [
    {
      title: 'New cozy step',
      due_date: '2026-11-09',
      estimated_minutes: 10,
    },
    {
      title: 'Another soft practice',
      due_date: '2026-11-10',
      estimated_minutes: 10,
    },
  ],
  mochi_message: "Here's a gentle week of tiny steps.",
};

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

describe('weekPlanService (Issue #15)', () => {
  it('returns cached draft without calling AI again', async () => {
    const proposeWeekPlan = vi.fn();
    const quests = {
      findWeekPlanContext: vi.fn(async () => ({
        goal,
        milestone,
        draft,
        existingQuests: existing,
      })),
      saveWeekPlanDraft: vi.fn(),
      applyWeekPlanDraft: vi.fn(),
    } as unknown as QuestRepository;

    const service = createWeekPlanService({
      quests,
      ai: { proposeWeekPlan } as unknown as ChatAiClient,
      clock: fixedClock('2026-11-09T12:00:00.000Z'),
    });

    const result = await service.proposePlan(1);
    expect(result.draft).toEqual(draft);
    expect(proposeWeekPlan).not.toHaveBeenCalled();
    expect(quests.saveWeekPlanDraft).not.toHaveBeenCalled();
  });

  it('confirm is the only path that inserts quests', async () => {
    const applyWeekPlanDraft = vi.fn(async () => [
      {
        id: 20,
        milestone_id: 2,
        title: 'New cozy step',
        due_date: '2026-11-09',
        estimated_minutes: 10,
        completed_at: null,
      },
    ]);
    const quests = {
      findWeekPlanContext: vi.fn(async () => ({
        goal,
        milestone,
        draft,
        existingQuests: existing,
      })),
      saveWeekPlanDraft: vi.fn(),
      applyWeekPlanDraft,
    } as unknown as QuestRepository;

    const service = createWeekPlanService({
      quests,
      ai: {} as ChatAiClient,
      clock: fixedClock('2026-11-09T12:00:00.000Z'),
    });

    const result = await service.confirmPlan(1, draft);
    expect(applyWeekPlanDraft).toHaveBeenCalledTimes(1);
    expect(result.quests).toHaveLength(1);
    expect(result.mochi_message).toMatch(/gentle week/i);
  });

  it('rejects drafts that duplicate an existing title on the same day', async () => {
    const bad: WeekPlanDraft = {
      ...draft,
      quests: [
        {
          title: 'Existing A',
          due_date: '2026-11-09',
          estimated_minutes: 5,
        },
      ],
    };
    const quests = {
      findWeekPlanContext: vi.fn(async () => ({
        goal,
        milestone,
        draft: null,
        existingQuests: existing,
      })),
      saveWeekPlanDraft: vi.fn(),
      applyWeekPlanDraft: vi.fn(),
    } as unknown as QuestRepository;

    const service = createWeekPlanService({
      quests,
      ai: {
        proposeWeekPlan: vi.fn(async () => bad),
      } as unknown as ChatAiClient,
      clock: fixedClock('2026-11-09T12:00:00.000Z'),
    });

    await expect(service.proposePlan(1)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(quests.saveWeekPlanDraft).not.toHaveBeenCalled();
  });
});
