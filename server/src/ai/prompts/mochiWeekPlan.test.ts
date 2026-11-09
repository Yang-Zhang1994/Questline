import { describe, expect, it } from 'vitest';
import type { Milestone, MilestoneGoalSummary, Quest } from '@questline/shared';
import {
  buildEchoWeekPlan,
  findWeekPlanBudgetOverflow,
  findWeekPlanDuplicate,
  normalizeWeekPlan,
  weekWindow,
} from './mochiWeekPlan.js';

const goal: MilestoneGoalSummary = {
  id: 1,
  title: 'Read a Japanese novel',
  done_definition: null,
  starting_point: 'Know hiragana',
  time_budget_minutes_per_day: 20,
  deadline: null,
};

const milestone: Milestone = {
  id: 2,
  goal_id: 1,
  position: 1,
  title: 'Build a tiny daily reading habit',
  description: null,
  target_date: '2026-11-16',
  status: 'current',
};

const existing: Quest[] = [
  {
    id: 10,
    milestone_id: 2,
    title: 'Read 2 pages of your graded reader',
    due_date: '2026-11-09',
    estimated_minutes: 10,
    completed_at: null,
  },
  {
    id: 11,
    milestone_id: 2,
    title: 'Write down 3 new words',
    due_date: '2026-11-08',
    estimated_minutes: 10,
    completed_at: '2026-11-08T12:00:00.000Z',
  },
];

describe('mochiWeekPlan (Issue #15)', () => {
  it('weekWindow spans today through +6 days', () => {
    expect(weekWindow('2026-11-09')).toEqual({
      weekStart: '2026-11-09',
      weekEnd: '2026-11-15',
    });
  });

  it('echo draft stays within daily budget including existing load', () => {
    const draft = buildEchoWeekPlan(goal, milestone, existing, '2026-11-09');
    expect(draft.quests.length).toBeGreaterThan(0);
    expect(findWeekPlanBudgetOverflow(draft, existing, 20)).toBeNull();
    expect(findWeekPlanDuplicate(draft, existing)).toBeNull();
    for (const q of draft.quests) {
      expect(q.due_date >= draft.week_start).toBe(true);
      expect(q.due_date <= draft.week_end).toBe(true);
    }
  });

  it('detects duplicate titles on the same day', () => {
    const draft = {
      week_start: '2026-11-09',
      week_end: '2026-11-15',
      quests: [
        {
          title: 'Read 2 pages of your graded reader',
          due_date: '2026-11-09',
          estimated_minutes: 5,
        },
      ],
      mochi_message: 'Gentle week.',
    };
    expect(findWeekPlanDuplicate(draft, existing)).toMatch(/graded reader/i);
  });

  it('normalize strips guilt wording and out-of-window quests', () => {
    const normalized = normalizeWeekPlan(
      {
        week_start: '2026-11-09',
        week_end: '2026-11-15',
        quests: [
          {
            title: 'Soft review of hiragana',
            due_date: '2026-11-09',
            estimated_minutes: 5,
          },
          {
            title: 'Too far ahead',
            due_date: '2026-12-01',
            estimated_minutes: 10,
          },
        ],
        mochi_message: 'You fell behind — try harder?',
      },
      goal,
      milestone,
      existing,
      '2026-11-09',
    );
    expect(normalized.quests.every((q) => q.due_date <= '2026-11-15')).toBe(true);
    expect(normalized.mochi_message).not.toMatch(/\?/);
    expect(normalized.mochi_message.toLowerCase()).not.toMatch(/behind|failed|lazy/);
  });
});
