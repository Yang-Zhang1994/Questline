import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Milestone, MilestoneGoalSummary } from '@questline/shared';
import { RoadmapView } from './RoadmapView';

afterEach(() => {
  cleanup();
});

const goal: MilestoneGoalSummary = {
  id: 1,
  title: 'Read a Japanese novel on my own',
  done_definition: 'Finish one short novel',
  starting_point: 'Hiragana okay',
  time_budget_minutes_per_day: 20,
  deadline: '2027-11-09',
};

const milestones: Milestone[] = [
  {
    id: 10,
    goal_id: 1,
    position: 1,
    title: 'Build a tiny daily reading habit',
    description: 'Start soft',
    target_date: '2026-12-01',
    status: 'completed',
  },
  {
    id: 11,
    goal_id: 1,
    position: 2,
    title: 'Finish a graded reader',
    description: 'Level up',
    target_date: '2027-03-01',
    status: 'current',
  },
  {
    id: 12,
    goal_id: 1,
    position: 3,
    title: 'Attempt a short novel chapter',
    description: 'Stretch',
    target_date: '2027-06-01',
    status: 'upcoming',
  },
];

describe('RoadmapView (Issue #6)', () => {
  // AC: Roadmap shows Start, each milestone in order, and the final goal as nodes on a path
  it('renders Start, ordered milestones, and the final Goal on a path', () => {
    render(<RoadmapView goal={goal} milestones={milestones} />);

    const path = screen.getByTestId('roadmap-path');
    const nodes = within(path).getAllByTestId(/milestone-node-/);
    expect(nodes.map((n) => n.getAttribute('data-testid'))).toEqual([
      'milestone-node-start',
      'milestone-node-1',
      'milestone-node-2',
      'milestone-node-3',
      'milestone-node-goal',
    ]);

    expect(screen.getByText('Begin your journey')).toBeInTheDocument();
    expect(screen.getByText('Build a tiny daily reading habit')).toBeInTheDocument();
    expect(screen.getByText('Finish a graded reader')).toBeInTheDocument();
    expect(screen.getByText('Attempt a short novel chapter')).toBeInTheDocument();
    expect(screen.getAllByText(goal.title).length).toBeGreaterThanOrEqual(1);
  });

  // AC: The current stage is visually highlighted (text/icon, not color alone)
  it('highlights the current stage with You are here text and aria-current', () => {
    render(<RoadmapView goal={goal} milestones={milestones} />);

    const current = screen.getByTestId('milestone-node-2');
    expect(current).toHaveAttribute('data-state', 'current');
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(within(current).getByText(/you are here/i)).toBeInTheDocument();
  });

  // AC: Completed stages look different from upcoming ones
  it('marks completed and upcoming stages with distinct text labels and data-state', () => {
    render(<RoadmapView goal={goal} milestones={milestones} />);

    const cleared = screen.getByTestId('milestone-node-1');
    expect(cleared).toHaveAttribute('data-state', 'completed');
    expect(within(cleared).getByText(/cleared/i)).toBeInTheDocument();

    const ahead = screen.getByTestId('milestone-node-3');
    expect(ahead).toHaveAttribute('data-state', 'upcoming');
    expect(within(ahead).getByText(/ahead/i)).toBeInTheDocument();
  });

  // AC: Each node shows the milestone title and target date
  it('shows title and target date on each milestone node', () => {
    render(<RoadmapView goal={goal} milestones={milestones} />);

    for (const milestone of milestones) {
      const node = screen.getByTestId(`milestone-node-${milestone.position}`);
      expect(within(node).getByText(milestone.title)).toBeInTheDocument();
      expect(within(node).getByText(`Target: ${milestone.target_date}`)).toBeInTheDocument();
    }
  });

  // AC: Roadmap is readable on both mobile and desktop screen widths
  it('keeps the path region usable in a narrow viewport container', () => {
    const { container } = render(
      <div style={{ width: 320 }}>
        <RoadmapView goal={goal} milestones={milestones} />
      </div>,
    );

    expect(screen.getByRole('region', { name: /roadmap map/i })).toBeInTheDocument();
    expect(container.querySelector('[data-testid="roadmap-view"]')).toBeTruthy();
    expect(screen.getByTestId('roadmap-cleared-count')).toHaveTextContent('1/3 stages cleared');
  });
});
