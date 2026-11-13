import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { clearAuthToken } from './api/authToken';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  clearAuthToken();
});

beforeEach(() => {
  sessionStorage.clear();
  clearAuthToken();
});

describe('App auth gate & Today greeting note (Issues #8 & #9)', () => {
  it('shows login first, then Mochi greeting note with quest checkboxes on Today after demo login', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/login')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              user: { id: 1, email: 'demo@questline.local' },
              token: 'demo-jwt-token',
            }),
        };
      }
      if (url === '/api/quests' || url.startsWith('/api/quests?')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
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
                total_quests: 1,
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
              ],
            }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), 'demo@questline.local');
    await user.type(screen.getByLabelText(/password/i), 'demo-password-123');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('heading', { name: /questline/i })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: /a note from mochi/i })).toBeInTheDocument();
    expect(await screen.findByText(/Read 2 pages of your graded reader slowly/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Read 2 pages of your graded reader slowly/i })).not.toBeChecked();
  });

  // AC: Talk dock route loads Mochi Messenger
  it('navigates to Talk and loads chat history with Bearer auth', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('questline.authToken', 'demo-jwt-token');
    sessionStorage.setItem(
      'questline.authUser',
      JSON.stringify({ id: 1, email: 'demo@questline.local' }),
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/quests' || url.startsWith('/api/quests?')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              goal: null,
              milestone: null,
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
              quests: [],
            }),
        };
      }
      if (url.includes('/api/chat/messages') && (!init?.method || init.method === 'GET')) {
        const headers = new Headers(init?.headers);
        expect(headers.get('Authorization')).toBe('Bearer demo-jwt-token');
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              messages: [
                {
                  id: 1,
                  user_id: 1,
                  goal_id: null,
                  role: 'mochi',
                  content: "Hi, I'm Mochi! Let's chat.",
                  created_at: '2026-11-09T15:00:00Z',
                },
              ],
              interview: {
                status: 'in_progress',
                current_topic: 'done_definition',
                answered_topics: [],
                answers: {
                  done_definition: null,
                  starting_point: null,
                  time_budget: null,
                  deadline: null,
                },
              },
            }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('region', { name: /a note from mochi/i })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /talk/i }));

    expect(await screen.findByRole('region', { name: /mochi messenger/i })).toBeInTheDocument();
    expect(screen.getByText(/hi, i'm mochi/i)).toBeInTheDocument();
  });
});
