import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, setAuthToken } from './authToken';
import { fetchChatMessages, restartInterview, sendChatMessage } from './chat';

const interview = {
  status: 'in_progress' as const,
  current_topic: 'done_definition' as const,
  answered_topics: [] as const,
  answers: {
    done_definition: null,
    starting_point: null,
    time_budget: null,
    deadline: null,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  clearAuthToken();
});

beforeEach(() => {
  clearAuthToken();
  setAuthToken('demo-jwt-token');
});

describe('chat API client (Issue #3)', () => {
  it('GET history sends Bearer auth and parses interview state', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
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
                content: 'Hi!',
                created_at: '2026-11-09T15:00:00Z',
              },
            ],
            interview,
          }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchChatMessages();
    expect(result.messages).toHaveLength(1);
    expect(result.interview.current_topic).toBe('done_definition');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/chat/messages');
  });

  it('POST send includes content + Bearer auth and returns interview', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe('Bearer demo-jwt-token');
      expect(JSON.parse(String(init?.body))).toEqual({ content: 'hello' });
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            user_message: {
              id: 2,
              user_id: 1,
              goal_id: null,
              role: 'user',
              content: 'hello',
              created_at: '2026-11-09T15:01:00Z',
            },
            mochi_message: {
              id: 3,
              user_id: 1,
              goal_id: null,
              role: 'mochi',
              content: 'What would "done" look like?',
              created_at: '2026-11-09T15:01:01Z',
            },
            interview: {
              ...interview,
              answered_topics: [],
              current_topic: 'done_definition',
            },
          }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendChatMessage('hello');
    expect(result.mochi_message.content).toContain('done');
    expect(result.interview.status).toBe('in_progress');
  });

  it('POST restart hits /api/chat/interview/restart', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(String(_input)).toContain('/api/chat/interview/restart');
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            messages: [
              {
                id: 10,
                user_id: 1,
                goal_id: null,
                role: 'mochi',
                content: 'Welcome again',
                created_at: '2026-11-09T16:00:00Z',
              },
            ],
            interview,
          }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await restartInterview();
    expect(result.messages[0].content).toBe('Welcome again');
  });
});
