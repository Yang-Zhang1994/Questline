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

  it('opens the accessible milestone sheet when a milestone node is tapped, closes on Escape, and returns focus to the milestone node (Issue #20)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockPayload),
    } as Response);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          milestone: {
            id: 2,
            title: 'Build a tiny daily reading habit',
            description: 'Read graded readers for 15 minutes each day.',
            target_date: '2026-12-01',
            status: 'current',
            position: 2,
          },
          quests: [
            {
              id: 50,
              milestone_id: 2,
              title: 'Read 2 pages before tea',
              due_date: '2026-11-10',
              estimated_minutes: 15,
              completed_at: null,
            },
          ],
          done_count: 0,
          total_count: 1,
        }),
    } as Response);

    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>,
    );

    const node = await screen.findByTestId('milestone-node-2');
    node.focus();
    node.click();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(await screen.findByText('Read 2 pages before tea')).toBeInTheDocument();

    // Pressing Escape closes the dialog and restores focus to the milestone node
    const { fireEvent, waitFor } = await import('@testing-library/react');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(node);
  });
});
