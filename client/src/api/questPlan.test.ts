import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmQuestPlan, fetchQuestPlan, proposeQuestPlan } from './questPlan';
import { setAuthToken } from './authToken';

afterEach(() => {
  setAuthToken(null);
  vi.unstubAllGlobals();
});

const draft = {
  quests: [
    { title: 'Read 2 pages', due_date: '2026-11-09', estimated_minutes: 10 },
    { title: 'Write 3 words', due_date: '2026-11-10', estimated_minutes: 5 },
  ],
  mochi_message: 'Tiny quests ♡',
};

const responseBody = {
  draft,
  confirmed: false,
  goal: {
    id: 1,
    title: 'Read a Japanese novel on my own',
    done_definition: 'Finish one short novel',
    starting_point: 'Know hiragana',
    time_budget_minutes_per_day: 20,
    deadline: '2027-11-09',
  },
  milestone: {
    id: 2,
    goal_id: 1,
    position: 1,
    title: 'Build a tiny daily reading habit',
    description: 'Read a few pages each day',
    target_date: '2026-11-16',
    status: 'current',
  },
  quests: [],
};

describe('questPlan API client (Issue #7)', () => {
  it('fetches and proposes a draft with auth headers', async () => {
    setAuthToken('test-token');
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('/api/quests/draft');
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe('Bearer test-token');
      return new Response(JSON.stringify(responseBody), { status: init?.method === 'POST' ? 201 : 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchQuestPlan()).resolves.toMatchObject({ draft, confirmed: false });
    await expect(proposeQuestPlan()).resolves.toMatchObject({ draft });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('confirms a draft via POST /api/quests/confirm', async () => {
    setAuthToken('test-token');
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body)) as { draft: typeof draft };
      expect(body.draft.quests).toHaveLength(2);
      return new Response(
        JSON.stringify({
          goal: responseBody.goal,
          milestone: responseBody.milestone,
          quests: body.draft.quests.map((q, i) => ({
            id: i + 1,
            milestone_id: 2,
            title: q.title,
            due_date: q.due_date,
            estimated_minutes: q.estimated_minutes,
            completed_at: null,
          })),
        }),
        { status: 201 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await confirmQuestPlan(draft);
    expect(result.quests).toHaveLength(2);
    expect(result.quests[0].title).toBe('Read 2 pages');
  });
});
