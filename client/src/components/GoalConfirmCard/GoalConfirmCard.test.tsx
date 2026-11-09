import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GoalDraft } from '@questline/shared';
import { GoalConfirmCard } from './GoalConfirmCard';

afterEach(() => {
  cleanup();
});

const draft: GoalDraft = {
  title: 'Read a Japanese novel on my own within one year',
  done_definition: 'Finish one short Japanese novel without a dictionary',
  starting_point: 'Know hiragana and a few phrases',
  time_budget_minutes_per_day: 20,
  deadline: '2027-11-09',
  mochi_message: "Here's a concrete goal from what you shared. Accept when it feels right ♡",
};

describe('GoalConfirmCard (Issue #4)', () => {
  // AC: After the interview, Mochi proposes one goal statement with a deadline
  it('shows the proposed goal statement, deadline, starting point, and time budget', () => {
    render(
      <GoalConfirmCard
        draft={draft}
        onAccept={vi.fn()}
        onRevise={vi.fn()}
        onReturnToInterview={vi.fn()}
      />,
    );

    expect(screen.getByTestId('goal-draft-title')).toHaveTextContent(/Japanese novel/i);
    expect(screen.getByTestId('goal-draft-deadline')).toHaveTextContent('2027-11-09');
    expect(screen.getByTestId('goal-draft-starting-point')).toHaveTextContent(/hiragana/i);
    expect(screen.getByTestId('goal-draft-time-budget')).toHaveTextContent(/20 min/i);
  });

  // AC: User can accept the goal
  it('calls onAccept when Start this goal is pressed', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(
      <GoalConfirmCard
        draft={draft}
        onAccept={onAccept}
        onRevise={vi.fn()}
        onReturnToInterview={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('goal-accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  // AC: User can ask Mochi to revise it
  it('lets the user ask Mochi to revise with optional feedback', async () => {
    const user = userEvent.setup();
    const onRevise = vi.fn(async () => undefined);
    render(
      <GoalConfirmCard
        draft={draft}
        onAccept={vi.fn()}
        onRevise={onRevise}
        onReturnToInterview={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('goal-revise'));
    expect(screen.getByTestId('goal-revise-feedback')).toBeInTheDocument();
    await user.type(screen.getByTestId('goal-revise-feedback'), 'Make the deadline clearer');
    await user.click(screen.getByTestId('goal-revise'));
    expect(onRevise).toHaveBeenCalledWith('Make the deadline clearer');
  });

  // Assignment: revise returns to interview
  it('returns to the interview when Adjust answers is pressed', async () => {
    const user = userEvent.setup();
    const onReturnToInterview = vi.fn();
    render(
      <GoalConfirmCard
        draft={draft}
        onAccept={vi.fn()}
        onRevise={vi.fn()}
        onReturnToInterview={onReturnToInterview}
      />,
    );

    await user.click(screen.getByTestId('goal-return-interview'));
    expect(onReturnToInterview).toHaveBeenCalledTimes(1);
  });

  it('shows a saved state after confirm', () => {
    render(
      <GoalConfirmCard
        draft={null}
        confirmedGoal={{
          id: 1,
          user_id: 1,
          title: draft.title,
          done_definition: draft.done_definition,
          starting_point: draft.starting_point,
          time_budget_minutes_per_day: draft.time_budget_minutes_per_day,
          deadline: draft.deadline,
          status: 'active',
          created_at: '2026-11-09T15:00:00.000Z',
        }}
        onAccept={vi.fn()}
        onRevise={vi.fn()}
        onReturnToInterview={vi.fn()}
      />,
    );

    expect(screen.getByTestId('goal-confirmed-title')).toHaveTextContent(/Japanese novel/i);
    expect(screen.queryByTestId('goal-accept')).not.toBeInTheDocument();
  });
});
