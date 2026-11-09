import { describe, expect, it, vi } from 'vitest';
import type { Milestone, MilestoneGoalSummary, Quest, RescheduleDraft } from '@questline/shared';
import type { ChatAiClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import type { QuestRepository } from '../repositories/questRepository.js';
import { createRescheduleService } from './rescheduleService.js';

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

const overdue: Quest[] = [
  {
    id: 10,
    milestone_id: 2,
    title: 'A',
    due_date: '2026-11-05',
    estimated_minutes: 10,
    completed_at: null,
  },
  {
    id: 11,
    milestone_id: 2,
    title: 'B',
    due_date: '2026-11-06',
    estimated_minutes: 10,
    completed_at: null,
  },
];

const draft: RescheduleDraft = {
  moves: [
    {
      quest_id: 10,
      title: 'A',
      from_date: '2026-11-05',
      to_date: '2026-11-09',
      estimated_minutes: 10,
    },
    {
      quest_id: 11,
      title: 'B',
      from_date: '2026-11-06',
      to_date: '2026-11-10',
      estimated_minutes: 10,
    },
  ],
  mochi_message: "Let's adjust the plan together.",
};

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

describe('rescheduleService (Issue #14)', () => {
  it('returns cached draft without calling AI again', async () => {
    const proposeReschedule = vi.fn();
    const quests = {
      findRescheduleContext: vi.fn(async () => ({
        goal,
        milestone,
        draft,
        overdue,
        allQuests: overdue,
      })),
      saveRescheduleDraft: vi.fn(),
      applyRescheduleDraft: vi.fn(),
    } as unknown as QuestRepository;

    const service = createRescheduleService({
      quests,
      ai: { proposeReschedule } as unknown as ChatAiClient,
      clock: fixedClock('2026-11-09T12:00:00.000Z'),
    });

    const result = await service.proposePlan(1);
    expect(result.draft).toEqual(draft);
    expect(proposeReschedule).not.toHaveBeenCalled();
    expect(quests.saveRescheduleDraft).not.toHaveBeenCalled();
  });

  it('confirm is the only path that applies due dates', async () => {
    const applyRescheduleDraft = vi.fn(async () => [
      { ...overdue[0], due_date: '2026-11-09' },
      { ...overdue[1], due_date: '2026-11-10' },
    ]);
    const quests = {
      findRescheduleContext: vi.fn(async () => ({
        goal,
        milestone,
        draft,
        overdue,
        allQuests: overdue,
      })),
      saveRescheduleDraft: vi.fn(),
      applyRescheduleDraft,
    } as unknown as QuestRepository;

    const service = createRescheduleService({
      quests,
      ai: {} as ChatAiClient,
      clock: fixedClock('2026-11-09T12:00:00.000Z'),
    });

    const result = await service.confirmPlan(1, draft);
    expect(applyRescheduleDraft).toHaveBeenCalledWith(1, 1, expect.objectContaining({ moves: draft.moves }));
    expect(result.quests).toHaveLength(2);
  });
});
