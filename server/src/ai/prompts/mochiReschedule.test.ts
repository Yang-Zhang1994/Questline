import { describe, expect, it } from 'vitest';
import type { Milestone, MilestoneGoalSummary, Quest } from '@questline/shared';
import {
  buildEchoReschedule,
  findRescheduleBudgetOverflow,
  normalizeRescheduleDraft,
} from './mochiReschedule.js';

const goal: MilestoneGoalSummary = {
  id: 1,
  title: 'Read a Japanese novel',
  done_definition: 'Finish one book',
  starting_point: 'Hiragana',
  time_budget_minutes_per_day: 20,
  deadline: '2027-01-01',
};

const milestone: Milestone = {
  id: 2,
  goal_id: 1,
  position: 1,
  title: 'Tiny reading habit',
  description: null,
  target_date: '2026-11-16',
  status: 'current',
};

const overdue: Quest[] = [
  {
    id: 10,
    milestone_id: 2,
    title: 'Read 2 pages',
    due_date: '2026-11-05',
    estimated_minutes: 10,
    completed_at: null,
  },
  {
    id: 11,
    milestone_id: 2,
    title: 'New words',
    due_date: '2026-11-06',
    estimated_minutes: 10,
    completed_at: null,
  },
];

const todayQuest: Quest = {
  id: 12,
  milestone_id: 2,
  title: 'Say a sentence',
  due_date: '2026-11-09',
  estimated_minutes: 10,
  completed_at: null,
};

describe('mochiReschedule helpers (Issue #14)', () => {
  it('builds an echo draft covering every overdue quest from today forward', () => {
    const draft = buildEchoReschedule(
      goal,
      milestone,
      overdue,
      [...overdue, todayQuest],
      '2026-11-09',
    );
    expect(draft.moves).toHaveLength(2);
    expect(draft.moves.map((m) => m.quest_id).sort()).toEqual([10, 11]);
    for (const move of draft.moves) {
      expect(move.to_date >= '2026-11-09').toBe(true);
      expect(move.title).toBeTruthy();
    }
    expect(draft.mochi_message).toMatch(/adjust the plan together/i);
    expect(draft.mochi_message).not.toMatch(/\?/);
  });

  it('respects daily budget when placing moves', () => {
    const draft = buildEchoReschedule(
      goal,
      milestone,
      overdue,
      [...overdue, todayQuest],
      '2026-11-09',
    );
    expect(findRescheduleBudgetOverflow(draft, [...overdue, todayQuest], 20)).toBeNull();
  });

  it('normalizes model output to one move per overdue quest', () => {
    const raw = {
      moves: [
        {
          quest_id: 10,
          title: 'wrong title',
          from_date: '2026-11-01',
          to_date: '2026-11-10',
          estimated_minutes: 10,
        },
        {
          quest_id: 10,
          title: 'dup',
          from_date: '2026-11-01',
          to_date: '2026-11-11',
          estimated_minutes: 10,
        },
      ],
      mochi_message: 'Should we try again?',
    };
    const normalized = normalizeRescheduleDraft(
      raw,
      overdue,
      [...overdue, todayQuest],
      goal,
      milestone,
      '2026-11-09',
    );
    expect(normalized.moves).toHaveLength(2);
    expect(normalized.moves.find((m) => m.quest_id === 10)?.title).toBe('Read 2 pages');
    expect(normalized.moves.find((m) => m.quest_id === 11)).toBeTruthy();
    expect(normalized.mochi_message).toMatch(/adjust the plan together/i);
  });
});
