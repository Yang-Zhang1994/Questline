import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, setAuthToken } from './authToken';
import { fetchTodayQuests, setQuestCompletion } from './quests';

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
  },
};

describe('quests API client (Issue #8 / #9)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearAuthToken();
    setAuthToken('demo-jwt');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    clearAuthToken();
  });

  it('sends Authorization Bearer on GET /api/quests/today', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(todayPayload),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchTodayQuests('2026-11-09');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/quests/today?local_date=2026-11-09');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer demo-jwt');
  });

  it('sends Authorization Bearer on PATCH completion (check/undo)', async () => {
    const quest = { ...todayPayload.quests[0], completed_at: '2026-11-09T12:00:00Z' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          quest,
          progress: {
            xp: 10,
            level: 1,
            xp_into_level: 10,
            xp_for_next_level: 50,
          },
          leveled_up: false,
          level_up_message: null,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await setQuestCompletion(1, true);

    expect(result.progress.xp).toBe(10);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/quests/1/completion');
    expect(init.method).toBe('PATCH');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer demo-jwt');
    expect(headers.get('Content-Type')).toBe('application/json');
  });
});
