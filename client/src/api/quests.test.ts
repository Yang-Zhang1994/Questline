import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, setAuthToken } from './authToken';
import {
  createQuest,
  deleteQuest,
  fetchMilestoneQuests,
  fetchTodayQuests,
  setQuestCompletion,
} from './quests';

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
  overdue_quests: [],
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
  stamp_card: {
    card_number: 1,
    stamps_per_card: 7,
    stamped_dates: [],
    filled_count: 0,
    past_cards: [],
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
            current_streak: 1,
            best_streak: 1,
            last_active_date: '2026-11-09',
          },
          leveled_up: false,
          level_up_message: null,
          stamp_card: {
            card_number: 1,
            stamps_per_card: 7,
            stamped_dates: ['2026-11-09'],
            filled_count: 1,
            past_cards: [],
          },
          card_completed: false,
          card_reward_message: null,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await setQuestCompletion(1, true, '2026-11-09');

    expect(result.progress.xp).toBe(10);
    expect(result.progress.current_streak).toBe(1);
    expect(result.stamp_card.filled_count).toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/quests/1/completion');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({
      completed: true,
      local_date: '2026-11-09',
    });
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer demo-jwt');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('POSTs a manual quest to /api/quests (Issue #20)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          quest: {
            id: 9,
            milestone_id: 2,
            title: 'Sketch one kanji',
            due_date: '2026-11-09',
            estimated_minutes: null,
            completed_at: null,
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createQuest({
      milestoneId: 2,
      title: 'Sketch one kanji',
      dueDate: '2026-11-09',
    });

    expect(result.quest.id).toBe(9);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/quests');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      milestone_id: 2,
      title: 'Sketch one kanji',
      due_date: '2026-11-09',
    });
  });

  it('DELETEs a quest and parses XP reverse payload (Issue #20)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          quest: todayPayload.quests[0],
          xp_reversed: true,
          progress: todayPayload.progress,
          stamp_card: todayPayload.stamp_card,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await deleteQuest(1, '2026-11-09');
    expect(result.xp_reversed).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/quests/1');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(String(init.body))).toEqual({ local_date: '2026-11-09' });
  });

  it('GETs quests for a milestone sheet (Issue #20)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          milestone: {
            id: 2,
            title: 'Build a tiny daily reading habit',
            description: 'Start soft',
            target_date: '2026-12-01',
            status: 'current',
            position: 1,
          },
          quests: todayPayload.quests,
          done_count: 0,
          total_count: 1,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMilestoneQuests(2);
    expect(result.total_count).toBe(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/quests?milestone_id=2');
  });
});
