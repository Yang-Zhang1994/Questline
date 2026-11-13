import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Goal } from '@questline/shared';
import { GoalSelector } from './GoalSelector';

afterEach(() => {
  cleanup();
});

const goals: Goal[] = [
  {
    id: 1,
    user_id: 9,
    title: 'Read a Japanese novel on my own',
    done_definition: null,
    starting_point: null,
    time_budget_minutes_per_day: 30,
    deadline: '2027-10-28',
    status: 'active',
    created_at: '2026-10-28T12:00:00.000Z',
  },
  {
    id: 2,
    user_id: 9,
    title: 'Run a gentle 5K',
    done_definition: null,
    starting_point: null,
    time_budget_minutes_per_day: 20,
    deadline: '2027-03-01',
    status: 'paused',
    created_at: '2026-10-28T12:00:00.000Z',
  },
];

describe('GoalSelector (Issue #18)', () => {
  // AC: Current goal selector on Today switches the active goal
  it('lists goals and calls onSelect when the user switches', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onNewGoal = vi.fn();
    const onDelete = vi.fn();

    render(
      <GoalSelector
        goals={goals}
        activeGoalId={1}
        onSelect={onSelect}
        onNewGoal={onNewGoal}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByTestId('goal-selector')).toBeInTheDocument();
    expect(screen.getByText(/Current goal/i)).toBeInTheDocument();
    const select = screen.getByTestId('goal-selector-select');
    expect(select).toHaveValue('1');

    await user.selectOptions(select, '2');
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  // AC: User can start a new goal without deleting the current one
  it('offers ＋ New goal', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onNewGoal = vi.fn();
    const onDelete = vi.fn();

    render(
      <GoalSelector
        goals={goals}
        activeGoalId={1}
        onSelect={onSelect}
        onNewGoal={onNewGoal}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByTestId('goal-selector-new'));
    expect(onNewGoal).toHaveBeenCalledTimes(1);
  });

  // AC: Delete requires a confirmation step
  it('asks for confirmation before deleting', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onNewGoal = vi.fn();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <GoalSelector
        goals={goals}
        activeGoalId={1}
        onSelect={onSelect}
        onNewGoal={onNewGoal}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByTestId('goal-selector-delete'));
    expect(screen.getByTestId('goal-selector-delete-confirm')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('goal-selector-delete-confirm-yes'));
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
