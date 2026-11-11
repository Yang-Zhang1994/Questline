import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Milestone, ProposedMilestone, RoadmapGoal } from '@questline/shared';
import { MilestonePlanEditor } from './MilestonePlanEditor';

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

const sampleDraft: ProposedMilestone[] = [
  {
    title: 'Learn Katakana & Core Particles',
    description: 'Master katakana and basic grammar particles in 30-minute daily sessions.',
    target_date: '2026-12-15',
  },
  {
    title: 'Finish Level 1 Graded Readers',
    description: 'Read 5 short beginner stories with high comprehension.',
    target_date: '2027-03-15',
  },
  {
    title: 'Read a Slice-of-Life Manga',
    description: 'Practice natural dialogue and everyday expressions.',
    target_date: '2027-06-30',
  },
  {
    title: 'Complete First Short Novel',
    description: 'Read cover-to-cover at your own pace before the deadline.',
    target_date: '2027-10-01',
  },
];

const savedMilestones: Milestone[] = sampleDraft.map((m, idx) => ({
  id: idx + 1,
  goal_id: 1,
  position: idx + 1,
  title: m.title,
  description: m.description,
  target_date: m.target_date,
  status: idx === 0 ? 'current' : 'upcoming',
}));

describe('MilestonePlanEditor (Issue #5)', () => {
  it('renders nothing when there is no active goal', () => {
    const { container } = render(
      <MilestonePlanEditor
        goal={null}
        draftMilestones={null}
        savedMilestones={[]}
        onPropose={vi.fn()}
        onAdjust={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  // AC: Mochi proposes 3–7 ordered milestones based on confirmed goal, deadline, and time budget
  it('shows active goal details and triggers onPropose when "Draw my map" is clicked', async () => {
    const user = userEvent.setup();
    const onPropose = vi.fn();

    render(
      <MilestonePlanEditor
        goal={sampleGoal}
        draftMilestones={null}
        savedMilestones={[]}
        onPropose={onPropose}
        onAdjust={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: /milestone plan/i })).toBeInTheDocument();
    expect(screen.getByText(sampleGoal.title)).toBeInTheDocument();
    expect(screen.getByText(/2027-10-28/)).toBeInTheDocument();
    expect(screen.getByText(/30 min\/day/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /draw my map/i }));
    expect(onPropose).toHaveBeenCalledTimes(1);
  });

  // AC: Each milestone has a title, a short description, and a target date before the goal deadline;
  // Milestones are saved only after the user confirms the plan.
  it('renders proposed draft milestones in order with title, description, target date, and draft notice', () => {
    render(
      <MilestonePlanEditor
        goal={sampleGoal}
        draftMilestones={sampleDraft}
        savedMilestones={[]}
        onPropose={vi.fn()}
        onAdjust={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByTestId('milestone-draft-badge')).toHaveTextContent(/draft/i);

    sampleDraft.forEach((item, idx) => {
      const card = screen.getByTestId(`proposed-milestone-${idx + 1}`);
      expect(card).toHaveTextContent(`Stage ${idx + 1}`);
      expect(card).toHaveTextContent(item.title);
      expect(card).toHaveTextContent(item.description);
      expect(card).toHaveTextContent(item.target_date);
    });
  });

  // AC: User can ask Mochi to add, remove, rename, or reorder milestones before agreeing
  it('submits adjustment instructions to Mochi via onAdjust', async () => {
    const user = userEvent.setup();
    const onAdjust = vi.fn();

    render(
      <MilestonePlanEditor
        goal={sampleGoal}
        draftMilestones={sampleDraft}
        savedMilestones={[]}
        onPropose={vi.fn()}
        onAdjust={onAdjust}
        onConfirm={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/ask mochi to adjust milestones/i);
    await user.type(input, 'Add a vocabulary stage before graded readers');
    await user.click(screen.getByRole('button', { name: /adjust with mochi/i }));

    expect(onAdjust).toHaveBeenCalledWith('Add a vocabulary stage before graded readers');
    expect(input).toHaveValue('');
  });

  // AC: Milestones are saved only after the user confirms the plan
  it('calls onConfirm when the user clicks Confirm milestones and displays saved stages afterwards', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    const { rerender } = render(
      <MilestonePlanEditor
        goal={sampleGoal}
        draftMilestones={sampleDraft}
        savedMilestones={[]}
        onPropose={vi.fn()}
        onAdjust={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: /confirm milestones/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(
      <MilestonePlanEditor
        goal={sampleGoal}
        draftMilestones={null}
        savedMilestones={savedMilestones}
        confirmed
        onPropose={vi.fn()}
        onAdjust={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByTestId('milestone-confirmed-banner')).toHaveTextContent(/saved/i);
    expect(screen.getByTestId('saved-milestone-1')).toHaveTextContent(/current/i);
    expect(screen.getByTestId('saved-milestone-2')).toHaveTextContent(/upcoming/i);
  });

  it('disables the Confirm button while saving is in progress', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <MilestonePlanEditor
        goal={sampleGoal}
        draftMilestones={sampleDraft}
        savedMilestones={[]}
        confirming
        onPropose={vi.fn()}
        onAdjust={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /saving plan/i });
    expect(confirmButton).toBeDisabled();

    await user.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
