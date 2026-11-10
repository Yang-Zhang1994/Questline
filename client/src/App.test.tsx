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

describe('App auth gate (after #8/#9 revert)', () => {
  it('shows login first, then Today shell after demo login (no quest check-off)', async () => {
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
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), 'demo@questline.local');
    await user.type(screen.getByLabelText(/password/i), 'demo-password-123');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('heading', { name: /questline/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /today placeholder/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /a note from mochi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
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

    expect(await screen.findByRole('region', { name: /today placeholder/i })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /talk/i }));

    expect(await screen.findByRole('region', { name: /mochi messenger/i })).toBeInTheDocument();
    expect(screen.getByText(/hi, i'm mochi/i)).toBeInTheDocument();
  });
});
