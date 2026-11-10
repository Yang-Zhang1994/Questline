import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoadmapView } from './RoadmapView';
import { MOCK_GOAL, MOCK_MILESTONES } from './mockData';

afterEach(() => {
  cleanup();
});

describe('RoadmapView (Issue #6)', () => {
  // AC: Renders game-style roadmap from Start to final goal
  it('renders the journey from Start through all milestones to the goal', () => {
    render(<RoadmapView goal={MOCK_GOAL} milestones={MOCK_MILESTONES} />);

    // Roadmap region
    expect(
      screen.getByRole('region', { name: /roadmap from start to final goal/i })
    ).toBeInTheDocument();

    // Start checkpoint
    expect(screen.getByText(/where your journey begins/i)).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();

    // All milestone titles are displayed in order
    for (const milestone of MOCK_MILESTONES) {
      expect(screen.getByText(milestone.title)).toBeInTheDocument();
    }

    // Final goal indicator
    expect(screen.getByText('Final Goal')).toBeInTheDocument();
  });

  // AC: User can see which stage they are currently on
  it('clearly marks the current stage with Mochi and "You are here"', () => {
    render(<RoadmapView goal={MOCK_GOAL} milestones={MOCK_MILESTONES} />);

    // Stage 2 is 'current' in mock data
    const currentCard = screen.getByTestId('milestone-node-2');
    expect(currentCard).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/You are here!/i)).toBeInTheDocument();
  });

  // AC: Header shows goal title, deadline, and stages cleared summary
  it('displays the goal title, target deadline, and stages cleared in the HUD', () => {
    render(<RoadmapView goal={MOCK_GOAL} milestones={MOCK_MILESTONES} />);

    expect(screen.getByText(MOCK_GOAL.title)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Target Deadline: ${MOCK_GOAL.deadline}`, 'i'))
    ).toBeInTheDocument();
    expect(screen.getByText(/1\/5 stages cleared/i)).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '1');
    expect(progressbar).toHaveAttribute('aria-valuemax', '5');
  });

  // AC: Empty state renders friendly Mochi card when roadmap is blank
  it('renders loading state when loading without a goal', () => {
    render(<RoadmapView goal={null} milestones={[]} loading />);

    expect(screen.getByRole('region', { name: /loading roadmap/i })).toBeInTheDocument();
    expect(screen.getByText(/mochi is unrolling your roadmap…/i)).toBeInTheDocument();
  });

  it('renders error state when error is provided', () => {
    render(<RoadmapView error="Could not load roadmap" />);

    expect(screen.getByRole('region', { name: /roadmap error/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load roadmap');
  });

  it('renders empty note when there are no milestones', () => {
    render(<RoadmapView goal={null} milestones={[]} />);

    expect(
      screen.getByRole('region', { name: /blank roadmap/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your map is still blank!/i)
    ).toBeInTheDocument();
  });

  it('triggers onPlanGoal when clicking the button in the empty state', async () => {
    const user = userEvent.setup();
    const onPlan = vi.fn();

    render(
      <RoadmapView goal={null} milestones={[]} onPlanGoal={onPlan} />
    );

    const button = screen.getByRole('button', {
      name: /plan a goal with mochi/i,
    });
    await user.click(button);
    expect(onPlan).toHaveBeenCalledTimes(1);
  });
});
