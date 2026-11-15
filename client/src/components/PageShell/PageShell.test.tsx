import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageShell } from './PageShell';
import { TodayPage } from '../../pages/TodayPage';
import { MapPage } from '../../pages/MapPage';
import { TalkPage } from '../../pages/TalkPage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PageShell & global bottom dock clearance', () => {
  it('applies pb-dock-safe to the shared page shell and renders the BottomDock', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <PageShell userEmail="mochi@questline.local" onLogout={vi.fn()}>
          <div data-testid="page-body">Content</div>
        </PageShell>
      </MemoryRouter>,
    );

    const shell = screen.getByTestId('page-shell');
    expect(shell.className).toContain('pb-dock-safe');
    expect(screen.getByTestId('page-body')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument();
  });

  it('uses the shared PageShell with pb-dock-safe across Today, Map, and Talk', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          goal: null,
          milestone: null,
          milestones: [],
          goals: [],
          active_goal_id: null,
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
          stamp_card: {
            card_number: 1,
            stamps_per_card: 10,
            stamped_dates: [],
            filled_count: 0,
            past_cards: [],
          },
          stage_ready: false,
          stage_ready_milestone: null,
          quests: [],
          messages: [],
          interview: null,
        }),
    } as Response);

    const { unmount: unmountToday } = render(
      <MemoryRouter initialEntries={['/']}>
        <TodayPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('page-shell').className).toContain('pb-dock-safe');
    unmountToday();

    const { unmount: unmountMap } = render(
      <MemoryRouter initialEntries={['/map']}>
        <MapPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('page-shell').className).toContain('pb-dock-safe');
    unmountMap();

    const { unmount: unmountTalk } = render(
      <MemoryRouter initialEntries={['/talk']}>
        <TalkPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('page-shell').className).toContain('pb-dock-safe');
    unmountTalk();
  });
});
