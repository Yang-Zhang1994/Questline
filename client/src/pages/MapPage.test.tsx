import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapPage } from './MapPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderMap() {
  return render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );
}

describe('MapPage (Issue #6)', () => {
  it('shows the blank-map empty state when milestones are not confirmed yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            draft: null,
            confirmed: false,
            goal: null,
            milestones: [],
          }),
      })),
    );

    renderMap();

    expect(await screen.findByTestId('map-empty')).toBeInTheDocument();
    expect(screen.getByText(/your map is still blank/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /plan a quest with mochi/i })).toHaveAttribute(
      'href',
      '/talk',
    );
  });

  it('wires confirmed milestones from the #5 plan API into RoadmapView', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toContain('/api/milestones/draft');
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              draft: null,
              confirmed: true,
              goal: {
                id: 1,
                title: 'Read a Japanese novel on my own',
                done_definition: null,
                starting_point: null,
                time_budget_minutes_per_day: 20,
                deadline: '2027-11-09',
              },
              milestones: [
                {
                  id: 10,
                  goal_id: 1,
                  position: 1,
                  title: 'Build a tiny daily reading habit',
                  description: 'Start soft',
                  target_date: '2026-12-01',
                  status: 'current',
                },
                {
                  id: 11,
                  goal_id: 1,
                  position: 2,
                  title: 'Finish a graded reader',
                  description: 'Level up',
                  target_date: '2027-03-01',
                  status: 'upcoming',
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
              ],
            }),
        };
      }),
    );

    renderMap();

    expect(await screen.findByRole('region', { name: /roadmap map/i })).toBeInTheDocument();
    expect(screen.getByTestId('milestone-node-start')).toBeInTheDocument();
    expect(screen.getByTestId('milestone-node-1')).toHaveAttribute('data-state', 'current');
    expect(screen.getByTestId('milestone-node-goal')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('map-empty')).not.toBeInTheDocument();
    });
  });

  // AC: tapping a milestone opens the sheet with New quest / Due date / Add
  it('opens the milestone sheet when a stage node is tapped (Issue #20)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/milestones/draft')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                draft: null,
                confirmed: true,
                goal: {
                  id: 1,
                  title: 'Read a Japanese novel on my own',
                  done_definition: null,
                  starting_point: null,
                  time_budget_minutes_per_day: 20,
                  deadline: '2027-11-09',
                },
                milestones: [
                  {
                    id: 10,
                    goal_id: 1,
                    position: 1,
                    title: 'Build a tiny daily reading habit',
                    description: 'Start soft',
                    target_date: '2026-12-01',
                    status: 'current',
                  },
                ],
              }),
          };
        }
        if (url.includes('/api/quests?milestone_id=10')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                milestone: {
                  id: 10,
                  title: 'Build a tiny daily reading habit',
                  description: 'Start soft',
                  target_date: '2026-12-01',
                  status: 'current',
                  position: 1,
                },
                quests: [
                  {
                    id: 1,
                    milestone_id: 10,
                    title: 'Read 2 pages',
                    due_date: '2026-10-28',
                    estimated_minutes: 15,
                    completed_at: null,
                  },
                ],
                done_count: 0,
                total_count: 1,
              }),
          };
        }
        return { ok: false, text: async () => JSON.stringify({ error: { message: 'nope' } }) };
      }),
    );

    renderMap();

    await user.click(await screen.findByRole('button', { name: /open stage sheet/i }));
    expect(await screen.findByTestId('milestone-sheet')).toBeInTheDocument();
    expect(screen.getByLabelText(/new quest/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete read 2 pages/i })).toBeInTheDocument();
  });
});
