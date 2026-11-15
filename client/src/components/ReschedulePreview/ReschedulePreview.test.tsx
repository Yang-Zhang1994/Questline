import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Milestone, Quest, RescheduleMove, RoadmapGoal } from '@questline/shared';
import { ReschedulePreview } from './ReschedulePreview';

afterEach(() => {
  cleanup();
});

const GUILT_WORDS_REGEX = /\b(overdue|late|behind|failed|fail|failure)\b/i;

const sampleGoal: RoadmapGoal = {
  id: 1,
  title: 'Read a Japanese novel on my own',
  done_definition: 'Finish one short novel without looking up every word',
  starting_point: 'Know hiragana',
  time_budget_minutes_per_day: 30,
  deadline: '2027-10-28',
  status: 'active',
};

const sampleMilestone: Milestone = {
  id: 10,
  goal_id: 1,
  position: 1,
  title: 'Learn Katakana & Core Particles',
  description: 'Master katakana and basic grammar particles in 30-minute daily sessions.',
  target_date: '2026-12-15',
  status: 'current',
  total_quests: 3,
  done_quests: 0,
};

const existingQuests: Quest[] = [
  {
    id: 101,
    milestone_id: 10,
    title: 'Earlier katakana drill',
    due_date: '2026-11-08',
    estimated_minutes: 15,
    completed_at: null,
  },
  {
    id: 102,
    milestone_id: 10,
    title: 'Earlier particle practice',
    due_date: '2026-11-09',
    estimated_minutes: 20,
    completed_at: null,
  },
  {
    id: 103,
    milestone_id: 10,
    title: 'Already scheduled today warmup',
    due_date: '2026-11-10',
    estimated_minutes: 10,
    completed_at: null,
  },
];

const sampleMoves: RescheduleMove[] = [
  {
    quest_id: 101,
    title: 'Earlier katakana drill',
    from_date: '2026-11-08',
    to_date: '2026-11-10',
    estimated_minutes: 15,
  },
  {
    quest_id: 102,
    title: 'Earlier particle practice',
    from_date: '2026-11-09',
    to_date: '2026-11-11',
    estimated_minutes: 20,
  },
];

describe('ReschedulePreview (Issue #14)', () => {
  it('renders Mochi’s encouraging message and shows each quest’s old date → new date grouped by new day with daily totals (including existing quests), with no guilt wording', () => {
    const { container } = render(
      <ReschedulePreview
        goal={sampleGoal}
        milestone={sampleMilestone}
        windowStart="2026-11-10"
        windowEnd="2026-11-16"
        timeBudgetMinutesPerDay={30}
        overdueQuests={existingQuests.slice(0, 2)}
        existingQuests={existingQuests}
        draftMoves={sampleMoves}
        mochiMessage="Let's gently tuck these quests into the next couple of days so everything feels light and doable ♡"
        onPropose={vi.fn()}
        onAdjust={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByTestId('reschedule-preview')).toBeInTheDocument();
    expect(screen.getByTestId('reschedule-draft-badge')).toHaveTextContent(/preview/i);
    expect(screen.getByTestId('reschedule-mochi-message')).toHaveTextContent(
      /gently tuck these quests/i,
    );

    // Day 2026-11-10: 10m existing + 15m moved = 25 / 30 min
    const day1 = screen.getByTestId('reschedule-day-2026-11-10');
    expect(day1).toHaveTextContent('Earlier katakana drill');
    expect(day1).toHaveTextContent('2026-11-08');
    expect(day1).toHaveTextContent('2026-11-10');
    expect(day1).toHaveTextContent('Already scheduled today warmup');
    expect(screen.getByTestId('reschedule-day-total-2026-11-10')).toHaveTextContent(
      'Total: 25 / 30 min',
    );

    // Day 2026-11-11: 0m existing + 20m moved = 20 / 30 min
    const day2 = screen.getByTestId('reschedule-day-2026-11-11');
    expect(day2).toHaveTextContent('Earlier particle practice');
    expect(day2).toHaveTextContent('2026-11-09');
    expect(day2).toHaveTextContent('2026-11-11');
    expect(screen.getByTestId('reschedule-day-total-2026-11-11')).toHaveTextContent(
      'Total: 20 / 30 min',
    );

    // Zero guilt words anywhere in the rendered component
    expect(container.textContent ?? '').not.toMatch(GUILT_WORDS_REGEX);
  });

  it('submits adjustment feedback via onAdjust and saves only when the user confirms via onConfirm', async () => {
    const user = userEvent.setup();
    const onAdjust = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ReschedulePreview
        goal={sampleGoal}
        milestone={sampleMilestone}
        windowStart="2026-11-10"
        windowEnd="2026-11-16"
        timeBudgetMinutesPerDay={30}
        overdueQuests={existingQuests.slice(0, 2)}
        existingQuests={existingQuests}
        draftMoves={sampleMoves}
        mochiMessage="Here is a gentle new schedule for your quests ♡"
        onPropose={vi.fn()}
        onAdjust={onAdjust}
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByLabelText(/ask mochi to adjust/i);
    await user.type(input, 'Move katakana drill to tomorrow');
    await user.click(screen.getByRole('button', { name: /ask mochi for changes/i }));

    expect(onAdjust).toHaveBeenCalledWith('Move katakana drill to tomorrow');
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('accept-reschedule-button'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
