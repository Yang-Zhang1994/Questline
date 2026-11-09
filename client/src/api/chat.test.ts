import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, setAuthToken } from './authToken';
import { fetchChatMessages, sendChatMessage } from './chat';

afterEach(() => {
  vi.unstubAllGlobals();
  clearAuthToken();
});

beforeEach(() => {
  clearAuthToken();
  setAuthToken('demo-jwt-token');
});

describe('chat API client (Issue #2)', () => {
  it('GET history sends Bearer auth', async () => {
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
          }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchChatMessages();
    expect(result.messages).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/chat/messages');
  });

  it('POST send includes content + Bearer auth', async () => {
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
              content: 'Hi back!',
              created_at: '2026-11-09T15:01:01Z',
            },
          }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendChatMessage('hello');
    expect(result.mochi_message.content).toBe('Hi back!');
  });
});
