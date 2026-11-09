import { describe, expect, it } from 'vitest';
import type { Milestone, MilestoneGoalSummary, QuestPlanDraft } from '@questline/shared';
import {
  buildEchoQuestPlan,
  findBudgetOverflow,
  normalizeQuestPlan,
  resolveDailyBudget,
} from './mochiQuestPlan.js';

const goal: MilestoneGoalSummary = {
  id: 1,
  title: 'Read a Japanese novel on my own',
  done_definition: 'Finish one short Japanese novel',
  starting_point: 'Know hiragana',
  time_budget_minutes_per_day: 20,
  deadline: '2027-11-09',
};

const milestone: Milestone = {
  id: 10,
  goal_id: 1,
  position: 1,
  title: 'Build a tiny daily reading habit',
  description: 'Read a few pages each day',
  target_date: '2026-11-16',
  status: 'current',
};

describe('mochiQuestPlan prompts (Issue #7)', () => {
  it('resolves the daily budget from the goal (fallback when missing)', () => {
    expect(resolveDailyBudget(goal)).toBe(20);
    expect(
      resolveDailyBudget({ ...goal, time_budget_minutes_per_day: null }),
    ).toBe(30);
  });

  it('echo plan fits each day within the daily time budget', () => {
    const draft = buildEchoQuestPlan(goal, milestone, '2026-11-09');
    expect(draft.quests.length).toBeGreaterThan(0);
    for (const quest of draft.quests) {
      expect(quest.title.length).toBeGreaterThan(0);
      expect(quest.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(quest.estimated_minutes).toBeGreaterThan(0);
      expect(quest.estimated_minutes).toBeLessThanOrEqual(20);
    }
    expect(findBudgetOverflow(draft, 20)).toBeNull();
  });

  it('normalize trims days that exceed the budget', () => {
    const bloated: QuestPlanDraft = {
      quests: [
        { title: 'A', due_date: '2026-11-09', estimated_minutes: 15 },
        { title: 'B', due_date: '2026-11-09', estimated_minutes: 15 },
        { title: 'C', due_date: '2026-11-10', estimated_minutes: 10 },
      ],
      mochi_message: 'Too much?',
    };
    const normalized = normalizeQuestPlan(bloated, goal, milestone, '2026-11-09');
    expect(findBudgetOverflow(normalized, 20)).toBeNull();
    expect(normalized.mochi_message).not.toContain('?');
    const dayOne = normalized.quests.filter((q) => q.due_date === '2026-11-09');
    const dayOneTotal = dayOne.reduce((sum, q) => sum + q.estimated_minutes, 0);
    expect(dayOneTotal).toBeLessThanOrEqual(20);
  });
});
