import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Milestone, ProposedQuest, Quest, RoadmapGoal } from '@questline/shared';
import { WeekPlanPreview } from './WeekPlanPreview';

afterEach(() => {
  cleanup();
});

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
  total_quests: 2,
  done_quests: 1,
};

const existingQuests: Quest[] = [
  {
    id: 101,
    milestone_id: 10,
    title: 'Warm up with 10 katakana characters',
    due_date: '2026-11-10',
    estimated_minutes: 10,
    completed_at: '2026-11-10T10:00:00Z',
  },
  {
    id: 102,
    milestone_id: 10,
    title: 'Review particle wa examples',
    due_date: '2026-11-11',
    estimated_minutes: 15,
    completed_at: null,
  },
];

const sampleDraftQuests: ProposedQuest[] = [
  {
    title: 'Practice katakana stroke order (Ka-Ko)',
    due_date: '2026-11-10',
    estimated_minutes: 15,
  },
  {
    title: 'Write 3 sentences with particle ga',
    due_date: '2026-11-11',
    estimated_minutes: 15,
  },
  {
    title: 'Read a short katakana menu aloud',
    due_date: '2026-11-12',
    estimated_minutes: 20,
  },
];

describe('WeekPlanPreview (Issue #15)', () => {
  it('renders nothing when there is no active goal or no current milestone', () => {
    const { container, rerender } = render(
      <WeekPlanPreview
        goal={null}
        milestone={sampleMilestone}
        draftQuests={null}
        onPropose={vi.fn()}
        onAdjust={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <WeekPlanPreview
        goal={sampleGoal}
        milestone={null}
        draftQuests={null}
        onPropose={vi.fn()}
        onAdjust={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  // AC: User can ask Mochi to plan the next 7 days of quests for the current milestone
  it('shows the current stage details and triggers onPropose when "Plan my week" is clicked', async () => {
    const user = userEvent.setup();
    const onPropose = vi.fn();

    render(
      <WeekPlanPreview
        goal={sampleGoal}
        milestone={sampleMilestone}
        draftQuests={null}
        onPropose={onPropose}
        onAdjust={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: /weekly quest plan/i })).toBeInTheDocument();
    expect(screen.getAllByText(sampleMilestone.title).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/30 min\/day budget/i).length).toBeGreaterThan(0);

    await user.click(screen.getByTestId('plan-my-week-button'));
    expect(onPropose).toHaveBeenCalledTimes(1);
  });

  // AC: The plan is shown as a preview grouped by day before saving, with each quest's title and minutes plus each day's total
  it('renders the proposed draft grouped by day with existing quests, proposed quest titles and minutes, and each day total', () => {
    render(
      <WeekPlanPreview
        goal={sampleGoal}
        milestone={sampleMilestone}
        windowStart="2026-11-10"
        windowEnd="2026-11-16"
        timeBudgetMinutesPerDay={30}
        existingQuests={existingQuests}
        draftQuests={sampleDraftQuests}
        onPropose={vi.fn()}
        onAdjust={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByTestId('week-plan-draft-badge')).toHaveTextContent(/draft preview/i);

    // Day 1: 2026-11-10 has 10m existing + 15m proposed = 25 / 30 min
    const day1 = screen.getByTestId('week-plan-day-2026-11-10');
    expect(day1).toHaveTextContent('Warm up with 10 katakana characters');
    expect(day1).toHaveTextContent('Practice katakana stroke order (Ka-Ko)');
    expect(day1).toHaveTextContent('~15 min');
    expect(screen.getByTestId('week-plan-day-total-2026-11-10')).toHaveTextContent(
      'Total: 25 / 30 min',
    );

    // Day 2: 2026-11-11 has 15m existing + 15m proposed = 30 / 30 min
    const day2 = screen.getByTestId('week-plan-day-2026-11-11');
    expect(day2).toHaveTextContent('Review particle wa examples');
    expect(day2).toHaveTextContent('Write 3 sentences with particle ga');
    expect(screen.getByTestId('week-plan-day-total-2026-11-11')).toHaveTextContent(
      'Total: 30 / 30 min',
    );

    // Day 3: 2026-11-12 has 0m existing + 20m proposed = 20 / 30 min
    const day3 = screen.getByTestId('week-plan-day-2026-11-12');
    expect(day3).toHaveTextContent('Read a short katakana menu aloud');
    expect(screen.getByTestId('week-plan-day-total-2026-11-12')).toHaveTextContent(
      'Total: 20 / 30 min',
    );
  });

  // AC: User can accept the plan or ask Mochi for changes
  it('submits adjustment feedback to Mochi via onAdjust and accepts the plan via onConfirm', async () => {
    const user = userEvent.setup();
    const onAdjust = vi.fn();
    const onConfirm = vi.fn();

    const { rerender } = render(
      <WeekPlanPreview
        goal={sampleGoal}
        milestone={sampleMilestone}
        windowStart="2026-11-10"
        windowEnd="2026-11-16"
        timeBudgetMinutesPerDay={30}
        existingQuests={existingQuests}
        draftQuests={sampleDraftQuests}
        onPropose={vi.fn()}
        onAdjust={onAdjust}
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByLabelText(/ask mochi to adjust weekly plan/i);
    await user.type(input, 'Make Wednesday lighter please');
    await user.click(screen.getByRole('button', { name: /ask mochi for changes/i }));

    expect(onAdjust).toHaveBeenCalledWith('Make Wednesday lighter please');
    expect(input).toHaveValue('');

    await user.click(screen.getByTestId('accept-week-plan-button'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(
      <WeekPlanPreview
        goal={sampleGoal}
        milestone={sampleMilestone}
        draftQuests={null}
        confirmed
        onPropose={vi.fn()}
        onAdjust={onAdjust}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByTestId('week-plan-confirmed-banner')).toHaveTextContent(/saved/i);
  });
});
