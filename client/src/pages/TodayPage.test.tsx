import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CurrentMilestoneQuestsResponse, ToggleQuestCompletionResponse } from '@questline/shared';
import { TodayPage } from './TodayPage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const basePayload: CurrentMilestoneQuestsResponse = {
  goal: {
    id: 1,
    title: 'Read a Japanese novel on my own',
    deadline: '2027-06-30',
    status: 'active',
  },
  milestone: {
    id: 10,
    goal_id: 1,
    position: 1,
    title: 'Build a tiny daily reading habit',
    description: 'Read 15 minutes every day.',
    target_date: '2026-12-01',
    status: 'current',
    total_quests: 3,
    done_quests: 0,
  },
  window_start: '2026-11-10',
  window_end: '2026-11-12',
  progress: {
    xp: 0,
    level: 1,
    xp_into_level: 0,
    xp_for_next_level: 50,
    current_streak: 0,
    best_streak: 0,
    last_active_date: null,
  },
  quests: [
    {
      id: 101,
      milestone_id: 10,
      title: 'Read 2 pages of your graded reader slowly',
      due_date: '2026-11-10',
      estimated_minutes: 15,
      completed_at: null,
    },
    {
      id: 102,
      milestone_id: 10,
      title: 'Jot down 3 new vocabulary words',
      due_date: '2026-11-10',
      estimated_minutes: 10,
      completed_at: null,
    },
    {
      id: 103,
      milestone_id: 10,
      title: 'Tomorrow quest — should NOT appear in today list',
      due_date: '2026-11-11',
      estimated_minutes: 20,
      completed_at: null,
    },
  ],
};

describe('TodayPage (Issue #8)', () => {
  it('lists only quests due today with their title and estimated minutes, and does not call POST /api/quests/generate when current window already has quests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(basePayload),
    } as Response);

    render(
      <BrowserRouter>
        <TodayPage />
      </BrowserRouter>,
    );

    expect(await screen.findByRole('region', { name: /a note from mochi/i })).toBeInTheDocument();
    expect(await screen.findByText(/Read 2 pages of your graded reader slowly/)).toBeInTheDocument();
    expect(screen.getByText('~15 min')).toBeInTheDocument();
    expect(screen.getByText(/Jot down 3 new vocabulary words/)).toBeInTheDocument();
    expect(screen.getByText('~10 min')).toBeInTheDocument();

    // Quest due tomorrow is excluded
    expect(
      screen.queryByText(/Tomorrow quest — should NOT appear in today list/),
    ).not.toBeInTheDocument();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/^\/api\/quests(\?local_date=\d{4}-\d{2}-\d{2})?$/);
  });

  it('nudges the user to Talk with Mochi when there is no active goal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          goal: null,
          milestone: null,
          window_start: '2026-11-10',
          window_end: '2026-11-12',
          quests: [],
        progress: {
    xp: 0,
    level: 1,
    xp_into_level: 0,
    xp_for_next_level: 50,
    current_streak: 0,
    best_streak: 0,
    last_active_date: null,
  },
        } satisfies CurrentMilestoneQuestsResponse),
    } as Response);

    render(
      <BrowserRouter>
        <TodayPage />
      </BrowserRouter>,
    );

    expect(await screen.findByRole('link', { name: /plan a goal with mochi/i })).toHaveAttribute(
      'href',
      '/talk',
    );
    expect(screen.getByTestId('mochi-greeting')).toHaveTextContent(
      /we don't have an active goal yet/i,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('nudges the user to "Draw my map" when a goal exists but has no confirmed milestones', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          goal: basePayload.goal,
          milestone: null,
          window_start: '2026-11-10',
          window_end: '2026-11-12',
          quests: [],
        progress: {
    xp: 0,
    level: 1,
    xp_into_level: 0,
    xp_for_next_level: 50,
    current_streak: 0,
    best_streak: 0,
    last_active_date: null,
  },
        } satisfies CurrentMilestoneQuestsResponse),
    } as Response);

    render(
      <BrowserRouter>
        <TodayPage />
      </BrowserRouter>,
    );

    expect(
      await screen.findByRole('link', { name: /draw my map with mochi/i }),
    ).toHaveAttribute('href', '/talk');
    expect(screen.getByTestId('mochi-greeting')).toHaveTextContent(/draw my map/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('calls POST /api/quests/generate when a current milestone has no quests yet, then shows today quests', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ...basePayload,
            quests: [],
          } satisfies CurrentMilestoneQuestsResponse),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(basePayload),
      } as Response);

    render(
      <BrowserRouter>
        <TodayPage />
      </BrowserRouter>,
    );

    expect(await screen.findByText(/Read 2 pages of your graded reader slowly/)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/^\/api\/quests(\?local_date=\d{4}-\d{2}-\d{2})?$/);
    expect(fetchSpy.mock.calls[1][0]).toBe('/api/quests/generate');
    expect(fetchSpy.mock.calls[1][1]?.method).toBe('POST');
  });

  it('calls POST /api/quests/generate when old quests exist from a past window but none are in the current window', async () => {
    const pastWindowOnlyPayload: CurrentMilestoneQuestsResponse = {
      ...basePayload,
      window_start: '2026-11-10',
      window_end: '2026-11-12',
      quests: [
        {
          id: 50,
          milestone_id: 10,
          title: 'Old quest from last week',
          due_date: '2026-11-05',
          estimated_minutes: 15,
          completed_at: '2026-11-05T18:00:00Z',
        },
        {
          id: 51,
          milestone_id: 10,
          title: 'Another past-window quest',
          due_date: '2026-11-07',
          estimated_minutes: 20,
          completed_at: null,
        },
      ],
    };

    const generatedPayload: CurrentMilestoneQuestsResponse = {
      ...basePayload,
      quests: [
        ...pastWindowOnlyPayload.quests,
        {
          id: 101,
          milestone_id: 10,
          title: 'Freshly generated quest for today',
          due_date: '2026-11-10',
          estimated_minutes: 15,
          completed_at: null,
        },
      ],
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(pastWindowOnlyPayload),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(generatedPayload),
      } as Response);

    render(
      <BrowserRouter>
        <TodayPage />
      </BrowserRouter>,
    );

    expect(await screen.findByText(/Freshly generated quest for today/)).toBeInTheDocument();
    expect(screen.queryByText(/Old quest from last week/)).not.toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/^\/api\/quests(\?local_date=\d{4}-\d{2}-\d{2})?$/);
    expect(fetchSpy.mock.calls[1][0]).toBe('/api/quests/generate');
    expect(fetchSpy.mock.calls[1][1]?.method).toBe('POST');
  });

  it('shows the friendly rest-day message when the current window has quests on later days, but none due today', async () => {
    const restDayPayload: CurrentMilestoneQuestsResponse = {
      ...basePayload,
      window_start: '2026-11-10',
      window_end: '2026-11-12',
      quests: [
        {
          id: 103,
          milestone_id: 10,
          title: 'Tomorrow quest in current window',
          due_date: '2026-11-11',
          estimated_minutes: 20,
          completed_at: null,
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(restDayPayload),
    } as Response);

    render(
      <BrowserRouter>
        <TodayPage />
      </BrowserRouter>,
    );

    expect(await screen.findByTestId('rest-day-subcopy')).toHaveTextContent(
      /rest days count too/i,
    );
    expect(screen.getByTestId('mochi-greeting').textContent).toMatch(/rest day|breather/i);
    expect(screen.queryByTestId('today-quest-item')).not.toBeInTheDocument();
    // Should NOT call POST /api/quests/generate since the current window already has quests
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('shows a friendly Mochi message (never raw JSON/Zod errors) when the server response is invalid or fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ broken: true }),
    } as Response);

    render(
      <BrowserRouter>
        <TodayPage />
      </BrowserRouter>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/mochi couldn't open today's quest note right now/i);
    expect(alert.textContent).not.toContain('[');
    expect(alert.textContent).not.toContain('invalid_type');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  describe('Quest check-off and undo (Issue #9)', () => {
    it('counts only today quests in the progress line, checks off immediately, disables while in-flight, and allows undoing', async () => {
      // basePayload has 2 quests on 2026-11-10 (today) and 1 quest on 2026-11-11 (tomorrow)
      // Even if tomorrow's quest were completed, the progress line must count only today's quests (0 of 2 done ♡).
      const payloadWithTomorrowDone: CurrentMilestoneQuestsResponse = {
        ...basePayload,
        quests: [
          basePayload.quests[0],
          basePayload.quests[1],
          {
            ...basePayload.quests[2],
            completed_at: '2026-11-10T10:00:00.000Z',
          },
        ],
      };

      let resolveCheck!: (value: Response) => void;
      const checkPromise = new Promise<Response>((resolve) => {
        resolveCheck = resolve;
      });

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(payloadWithTomorrowDone),
        } as Response)
        .mockReturnValueOnce(checkPromise)
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              quest: {
                ...basePayload.quests[0],
                completed_at: null,
              },
              progress: {
                xp: 10,
                level: 1,
                xp_into_level: 10,
                xp_for_next_level: 50,
                current_streak: 0,
                best_streak: 0,
                last_active_date: null,
              },
              leveled_up: false,
              level_up_message: null
            } satisfies ToggleQuestCompletionResponse),
        } as Response);

      render(
        <BrowserRouter>
          <TodayPage />
        </BrowserRouter>,
      );

      const firstCheckbox = await screen.findByRole('checkbox', {
        name: /Read 2 pages of your graded reader slowly/i,
      });
      expect(firstCheckbox).not.toBeChecked();
      // Only today's 2 quests are counted (0 of 2 done ♡)
      expect(screen.getByTestId('today-quests-progress')).toHaveTextContent('0 of 2 done ♡');

      // 1. Click to check off -> immediately checked, faded, progress updated, and disabled while request is in flight
      fireEvent.click(firstCheckbox);
      expect(firstCheckbox).toBeChecked();
      expect(firstCheckbox).toBeDisabled();
      expect(screen.getByTestId('today-quests-progress')).toHaveTextContent('1 of 2 done ♡');

      // Attempt a double-click while in flight -> does not send another request
      fireEvent.click(firstCheckbox);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[1][0]).toBe('/api/quests/101/completion');
      expect(fetchSpy.mock.calls[1][1]?.method).toBe('PATCH');
      const checkBody = JSON.parse(String(fetchSpy.mock.calls[1][1]?.body));
      expect(checkBody.completed).toBe(true);
      expect(checkBody.local_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Resolve server PATCH response
      resolveCheck({
        ok: true,
        text: async () =>
          JSON.stringify({
            quest: {
              ...basePayload.quests[0],
              completed_at: '2026-11-10T15:00:00.000Z',
            },
              progress: {
                xp: 10,
                level: 1,
                xp_into_level: 10,
                xp_for_next_level: 50,
                current_streak: 0,
                best_streak: 0,
                last_active_date: null,
              },
              leveled_up: false,
              level_up_message: null
            } satisfies ToggleQuestCompletionResponse),
      } as Response);

      await waitFor(() => {
        expect(firstCheckbox).not.toBeDisabled();
      });
      expect(firstCheckbox).toBeChecked();
      expect(screen.getByTestId('today-quests-progress')).toHaveTextContent('1 of 2 done ♡');

      // 2. Click again to undo -> unchecks and sends { completed: false }
      fireEvent.click(firstCheckbox);
      await waitFor(() => {
        expect(firstCheckbox).not.toBeChecked();
        expect(firstCheckbox).not.toBeDisabled();
      });
      expect(screen.getByTestId('today-quests-progress')).toHaveTextContent('0 of 2 done ♡');
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls[2][0]).toBe('/api/quests/101/completion');
      const undoBody = JSON.parse(String(fetchSpy.mock.calls[2][1]?.body));
      expect(undoBody.completed).toBe(false);
      expect(undoBody.local_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('reverts the checkbox immediately and shows a friendly message if saving fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(basePayload),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () =>
            JSON.stringify({
              error: {
                code: 'INTERNAL_ERROR',
                message: '',
              },
            }),
        } as Response);

      render(
        <BrowserRouter>
          <TodayPage />
        </BrowserRouter>,
      );

      const firstCheckbox = await screen.findByRole('checkbox', {
        name: /Read 2 pages of your graded reader slowly/i,
      });
      expect(firstCheckbox).not.toBeChecked();

      fireEvent.click(firstCheckbox);

      // Reverts back to unchecked after the failed request and shows friendly alert
      await waitFor(() => {
        expect(firstCheckbox).not.toBeChecked();
        expect(firstCheckbox).not.toBeDisabled();
      });

      expect(screen.getByTestId('today-quests-progress')).toHaveTextContent('0 of 2 done ♡');
      const alert = await screen.findByTestId('today-quest-toggle-error');
      expect(alert).toHaveTextContent(/couldn't save that check-off just now/i);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('keeps completed quests completed and visually distinct after a page reload', async () => {
      const reloadedPayload: CurrentMilestoneQuestsResponse = {
        ...basePayload,
        quests: [
          {
            ...basePayload.quests[0],
            completed_at: '2026-11-10T15:00:00.000Z',
          },
          basePayload.quests[1],
          basePayload.quests[2],
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(reloadedPayload),
      } as Response);

      render(
        <BrowserRouter>
          <TodayPage />
        </BrowserRouter>,
      );

      const firstCheckbox = await screen.findByRole('checkbox', {
        name: /Read 2 pages of your graded reader slowly/i,
      });
      const secondCheckbox = screen.getByRole('checkbox', {
        name: /Jot down 3 new vocabulary words/i,
      });

      expect(firstCheckbox).toBeChecked();
      expect(secondCheckbox).not.toBeChecked();
      expect(screen.getByTestId('today-quests-progress')).toHaveTextContent('1 of 2 done ♡');

      const items = screen.getAllByTestId('today-quest-item');
      expect(items[0]).toHaveAttribute('data-completed', 'true');
      expect(items[1]).toHaveAttribute('data-completed', 'false');
    });
  });
});
