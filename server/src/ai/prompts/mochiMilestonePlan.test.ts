import { describe, expect, it } from 'vitest';
import { buildEchoMilestonePlan, normalizeMilestonePlan } from './mochiMilestonePlan.js';

const goal = {
  id: 1,
  title: 'Read a Japanese novel on my own',
  done_definition: 'Finish one short Japanese novel',
  starting_point: 'Know hiragana',
  time_budget_minutes_per_day: 20,
  deadline: '2027-11-09',
};

describe('mochiMilestonePlan helpers (Issue #5)', () => {
  it('builds an echo plan with 3–7 dated milestones on/before the deadline', () => {
    const plan = buildEchoMilestonePlan(goal, '2026-11-09');
    expect(plan.milestones.length).toBeGreaterThanOrEqual(3);
    expect(plan.milestones.length).toBeLessThanOrEqual(7);
    for (const item of plan.milestones) {
      expect(item.target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.target_date <= '2027-11-09').toBe(true);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
    expect(plan.mochi_message.includes('?')).toBe(false);
  });

  it('honors add/remove feedback hints in the echo fallback', () => {
    const added = buildEchoMilestonePlan(goal, '2026-11-09', 'Please add another stage');
    expect(added.milestones).toHaveLength(5);
    const fewer = buildEchoMilestonePlan(goal, '2026-11-09', 'Make it fewer stages');
    expect(fewer.milestones).toHaveLength(3);
  });

  it('normalizes short AI output up to a valid 3–7 plan', () => {
    const normalized = normalizeMilestonePlan(
      {
        milestones: [
          {
            position: 9,
            title: 'Only one',
            description: 'Too short',
            target_date: '2027-01-01',
          },
        ],
        mochi_message: 'Oops?',
      },
      goal,
      '2026-11-09',
    );
    expect(normalized.milestones.length).toBeGreaterThanOrEqual(3);
    expect(normalized.mochi_message.includes('?')).toBe(false);
  });
});
