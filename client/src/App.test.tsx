import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { clearAuthToken } from './api/authToken';

const todayPayload = {
  local_date: '2026-11-09',
  goal_title: 'Read a Japanese novel on my own',
  milestone_title: 'Build a tiny daily reading habit',
  greeting: "Good afternoon! Here are today's little quests.",
  quests: [
    {
      id: 1,
      milestone_id: 2,
      title: 'Read 2 pages of your graded reader',
      due_date: '2026-11-09',
      estimated_minutes: 15,
      completed_at: null,
    },
  ],
  done_count: 0,
  total_count: 1,
  progress: {
    xp: 0,
    level: 1,
    xp_into_level: 0,
    xp_for_next_level: 50,
    current_streak: 0,
    best_streak: 0,
    last_active_date: null,
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  clearAuthToken();
});

beforeEach(() => {
  sessionStorage.clear();
  clearAuthToken();
  // BrowserRouter keeps window history across tests — reset to Today.
  window.history.pushState({}, '', '/');
});

describe('App auth gate (Issue #8)', () => {
  it('shows login first, then Today with Bearer-backed quests after demo login', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
      if (url.includes('/api/quests/today')) {
        const headers = new Headers(init?.headers);
        expect(headers.get('Authorization')).toBe('Bearer demo-jwt-token');
        return {
          ok: true,
          text: async () => JSON.stringify(todayPayload),
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

    expect(await screen.findByRole('region', { name: /a note from mochi/i })).toBeInTheDocument();
    expect(screen.getByText(todayPayload.greeting)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: todayPayload.quests[0].title })).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/quests/today'))).toBe(true);
    });
  });

  it('check-off sends Bearer Authorization on completion PATCH', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('questline.authToken', 'demo-jwt-token');
    sessionStorage.setItem(
      'questline.authUser',
      JSON.stringify({ id: 1, email: 'demo@questline.local' }),
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/quests/today')) {
        return {
          ok: true,
          text: async () => JSON.stringify(todayPayload),
        };
      }
      if (url.includes('/api/quests/1/completion')) {
        const headers = new Headers(init?.headers);
        expect(headers.get('Authorization')).toBe('Bearer demo-jwt-token');
        expect(init?.method).toBe('PATCH');
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              quest: { ...todayPayload.quests[0], completed_at: '2026-11-09T12:00:00Z' },
              progress: {
                xp: 10,
                level: 1,
                xp_into_level: 10,
                xp_for_next_level: 50,
                current_streak: 1,
                best_streak: 1,
                last_active_date: '2026-11-09',
              },
              leveled_up: false,
              level_up_message: null,
            }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByTestId('streak-counter')).toBeInTheDocument();

    const checkbox = await screen.findByRole('checkbox', { name: todayPayload.quests[0].title });
    await user.click(checkbox);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/completion'))).toBe(true);
    });
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
      if (url.includes('/api/quests/today')) {
        return {
          ok: true,
          text: async () => JSON.stringify(todayPayload),
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

  // AC: Map dock opens the roadmap view (Issue #6)
  it('navigates to Map and loads confirmed milestones with Bearer auth', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('questline.authToken', 'demo-jwt-token');
    sessionStorage.setItem(
      'questline.authUser',
      JSON.stringify({ id: 1, email: 'demo@questline.local' }),
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/quests/today')) {
        return {
          ok: true,
          text: async () => JSON.stringify(todayPayload),
        };
      }
      if (url.includes('/api/milestones/draft')) {
        const headers = new Headers(init?.headers);
        expect(headers.get('Authorization')).toBe('Bearer demo-jwt-token');
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
              ],
            }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('region', { name: /a note from mochi/i })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /map/i }));

    expect(await screen.findByRole('region', { name: /roadmap map/i })).toBeInTheDocument();
    expect(screen.getByTestId('milestone-node-start')).toBeInTheDocument();
    expect(screen.getByTestId('milestone-node-1')).toHaveAttribute('data-state', 'current');
    expect(screen.getByText(/finish a graded reader/i)).toBeInTheDocument();
  });
});
