import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MilestonePlanDraft } from '@questline/shared';
import { MilestonePlanEditor } from './MilestonePlanEditor';

afterEach(() => {
  cleanup();
});

const draft: MilestonePlanDraft = {
  milestones: [
    {
      position: 1,
      title: 'Tiny habit',
      description: 'Read a little each day',
      target_date: '2026-12-01',
    },
    {
      position: 2,
      title: 'Comfort basics',
      description: 'Build vocabulary gently',
      target_date: '2027-03-01',
    },
    {
      position: 3,
      title: 'Stretch practice',
      description: 'Try short stories',
      target_date: '2027-07-01',
    },
    {
      position: 4,
      title: 'Finish the novel',
      description: 'Complete the goal',
      target_date: '2027-11-01',
    },
  ],
  mochi_message: 'Here is a cozy 4-stage map toward your goal ♡',
};

const goal = {
  id: 1,
  title: 'Read a Japanese novel on my own',
  done_definition: 'Finish one short Japanese novel',
  starting_point: 'Know hiragana',
  time_budget_minutes_per_day: 20,
  deadline: '2027-11-09',
};

describe('MilestonePlanEditor (Issue #5)', () => {
  // AC: Mochi proposes 3–7 ordered milestones with title, description, target date
  it('shows ordered milestones with title, description, and target date', () => {
    render(
      <MilestonePlanEditor
        draft={draft}
        goal={goal}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );

    expect(screen.getByTestId('milestone-draft-list').children).toHaveLength(4);
    expect(screen.getByTestId('milestone-draft-title-1')).toHaveTextContent(/Tiny habit/i);
    expect(screen.getByTestId('milestone-draft-description-2')).toHaveTextContent(/vocabulary/i);
    expect(screen.getByTestId('milestone-draft-date-4')).toHaveTextContent('2027-11-01');
    expect(screen.getByTestId('milestone-goal-deadline')).toHaveTextContent('2027-11-09');
    expect(screen.getByTestId('milestone-draft-mochi-message')).toHaveTextContent(/cozy 4-stage/i);
  });

  // AC: user can ask Mochi to edit before agreeing
  it('lets the user ask Mochi to edit with feedback', async () => {
    const user = userEvent.setup();
    const onRevise = vi.fn(async () => undefined);
    render(
      <MilestonePlanEditor
        draft={draft}
        goal={goal}
        onConfirm={vi.fn()}
        onRevise={onRevise}
      />,
    );

    await user.click(screen.getByTestId('milestone-revise'));
    expect(screen.getByTestId('milestone-revise-feedback')).toBeInTheDocument();
    await user.type(screen.getByTestId('milestone-revise-feedback'), 'Add a celebration stage');
    await user.click(screen.getByTestId('milestone-revise'));
    expect(onRevise).toHaveBeenCalledWith('Add a celebration stage');
  });

  // AC: milestones are saved only after the user confirms
  it('calls onConfirm when save my map is pressed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <MilestonePlanEditor
        draft={draft}
        goal={goal}
        onConfirm={onConfirm}
        onRevise={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('milestone-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows a saved map after confirm', () => {
    render(
      <MilestonePlanEditor
        draft={null}
        goal={goal}
        confirmedMilestones={draft.milestones.map((item, index) => ({
          id: index + 1,
          goal_id: 1,
          position: item.position,
          title: item.title,
          description: item.description,
          target_date: item.target_date,
          status: item.position === 1 ? ('current' as const) : ('upcoming' as const),
        }))}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );

    expect(screen.getByTestId('milestone-saved-list').children).toHaveLength(4);
    expect(screen.getByText(/map is saved/i)).toBeInTheDocument();
  });
});
