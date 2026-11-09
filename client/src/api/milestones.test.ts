import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, setAuthToken } from './authToken';
import {
  confirmMilestonePlan,
  fetchMilestonePlan,
  proposeMilestonePlan,
  reviseMilestonePlan,
} from './milestones';

afterEach(() => {
  vi.unstubAllGlobals();
  clearAuthToken();
});

beforeEach(() => {
  clearAuthToken();
  setAuthToken('demo-jwt-token');
});

const draft = {
  milestones: [
    {
      position: 1,
      title: 'Tiny habit',
      description: 'Read a little each day',
      target_date: '2026-12-01',
    },
    {
      position: 2,
      title: 'Comfort basics',
      description: 'Build vocabulary gently',
      target_date: '2027-03-01',
    },
    {
      position: 3,
      title: 'Stretch practice',
      description: 'Try short stories',
      target_date: '2027-07-01',
    },
  ],
  mochi_message: 'Here is a cozy map ♡',
};

const planResponse = {
  draft,
  confirmed: false,
  goal: {
    id: 1,
    title: 'Read a Japanese novel on my own',
    done_definition: 'Finish one short Japanese novel',
    starting_point: 'Know hiragana',
    time_budget_minutes_per_day: 20,
    deadline: '2027-11-09',
  },
  milestones: [],
};

describe('milestones api (Issue #5)', () => {
  it('fetches the current draft plan with auth headers', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe('Bearer demo-jwt-token');
      return {
        ok: true,
        text: async () => JSON.stringify(planResponse),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMilestonePlan();
    expect(result.draft?.milestones).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledWith('/api/milestones/draft', expect.any(Object));
  });

  it('proposes and revises drafts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(planResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ...planResponse,
            draft: { ...draft, mochi_message: 'Tweaked ♡' },
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await proposeMilestonePlan();
    await reviseMilestonePlan('Add a stage');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/milestones/draft/revise',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('confirms a draft plan', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          goal: planResponse.goal,
          milestones: draft.milestones.map((item, index) => ({
            id: index + 1,
            goal_id: 1,
            ...item,
            status: item.position === 1 ? 'current' : 'upcoming',
          })),
        }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await confirmMilestonePlan(draft);
    expect(result.milestones).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/milestones/confirm',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
