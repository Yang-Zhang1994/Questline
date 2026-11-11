import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MilestoneNode } from './MilestoneNode';
import type { Milestone } from '@questline/shared';

afterEach(() => {
  cleanup();
});

const sampleMilestone: Milestone = {
  id: 2,
  goal_id: 1,
  position: 2,
  title: 'Build a tiny daily reading habit',
  description: 'Read graded readers for 15 minutes each day.',
  target_date: '2026-12-01',
  status: 'current',
  done_quests: 3,
  total_quests: 8,
};

describe('MilestoneNode (Issue #6)', () => {
  // AC: Displays milestone title, target date, and description
  it('renders milestone title, target date, and description', () => {
    render(<MilestoneNode milestone={sampleMilestone} isCurrent />);

    expect(screen.getByRole('heading', { level: 3, name: sampleMilestone.title })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(sampleMilestone.description!))).toBeInTheDocument();
    expect(screen.getByText(/Target: 2026-12-01/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage 2/i)).toBeInTheDocument();
  });

  // AC: Current stage is highlighted and shows Mochi / "You are here"
  it('highlights the current stage and shows "You are here" indicator', () => {
    render(<MilestoneNode milestone={sampleMilestone} isCurrent />);

    const card = screen.getByTestId('milestone-node-2');
    expect(card).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('You are here!')).toBeInTheDocument();
    expect(screen.getAllByText(/You are here/i)).toHaveLength(2);
  });

  // AC: Cleared/completed stage shows Cleared status
  it('renders cleared status badge for completed milestone', () => {
    const completedMilestone: Milestone = {
      ...sampleMilestone,
      id: 1,
      position: 1,
      status: 'completed',
    };

    render(<MilestoneNode milestone={completedMilestone} />);

    expect(screen.getByText(/Cleared/i)).toBeInTheDocument();
    expect(screen.queryByText(/You are here!/i)).not.toBeInTheDocument();
  });

  // AC: Upcoming stage shows Upcoming status
  it('renders upcoming status badge for future milestone', () => {
    const upcomingMilestone: Milestone = {
      ...sampleMilestone,
      id: 3,
      position: 3,
      status: 'upcoming',
    };

    render(<MilestoneNode milestone={upcomingMilestone} />);

    expect(screen.getByText(/Upcoming/i)).toBeInTheDocument();
  });

  // AC: Interaction / keyboard accessibility
  it('invokes onSelect when clicked or when pressing Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<MilestoneNode milestone={sampleMilestone} onSelect={onSelect} />);

    const button = screen.getByRole('button');
    await user.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sampleMilestone);

    button.focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
