import { cleanup, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapPage } from './MapPage';
import type { RoadmapResponse } from '@questline/shared';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockPayload: RoadmapResponse = {
  goal: {
    id: 1,
    title: 'Read a Japanese novel on my own',
    deadline: '2027-10-28',
    status: 'active',
  },
  milestones: [
    {
      id: 1,
      goal_id: 1,
      position: 1,
      title: 'Learn Hiragana & Katakana',
      description: 'Master reading and writing both basic syllabaries.',
      target_date: '2026-11-15',
      status: 'completed',
      done_quests: 1,
      total_quests: 1,
    },
    {
      id: 2,
      goal_id: 1,
      position: 2,
      title: 'Build a tiny daily reading habit',
      description: 'Read graded readers for 15 minutes each day.',
      target_date: '2026-12-01',
      status: 'current',
      done_quests: 0,
      total_quests: 3,
    },
  ],
};

describe('MapPage', () => {
  it('fetches roadmap from /api/roadmap and renders it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockPayload),
    } as Response);

    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    );

    // Initial loading indicator
    expect(screen.getByText(/mochi is unrolling your roadmap…/i)).toBeInTheDocument();

    // After fetch completes
    const titles = await screen.findAllByText('Read a Japanese novel on my own');
    expect(titles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Learn Hiragana & Katakana')).toBeInTheDocument();
    expect(screen.getByText('Build a tiny daily reading habit')).toBeInTheDocument();
    expect(screen.getByText(/1\/2 stages cleared/i)).toBeInTheDocument();
    expect(screen.getByTestId('roadmap-goal-node')).toBeInTheDocument();
  });

  it('renders error alert when server request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: { message: 'Server exploded' } }),
    } as Response);

    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded');
  });

  it('shows "No deadline set" when the goal deadline is null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          ...mockPayload,
          goal: {
            ...mockPayload.goal!,
            deadline: null,
          },
        }),
    } as Response);

    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>,
    );

    const noDeadlineEls = await screen.findAllByText(/Target Deadline: No deadline set/i);
    expect(noDeadlineEls.length).toBeGreaterThanOrEqual(1);
  });

  it('shows a friendly Mochi message and logs details to console instead of raw Zod error JSON', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          goal: {
            id: 1,
            title: 'Read a Japanese novel on my own',
            deadline: 'by 2027-11-12, about one year from now',
            status: 'active',
          },
          milestones: [],
        }),
    } as Response);

    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/mochi couldn't unroll your map right now/i);
    expect(alert.textContent).not.toContain('invalid_string');
    expect(alert.textContent).not.toContain('[');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
