import { cleanup, render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { Milestone, Quest, RoadmapGoal } from '@questline/shared';
import { DailyNote, MAX_VISIBLE_TODAY_QUESTS, buildMochiTodayGreeting } from './DailyNote';

afterEach(() => {
  cleanup();
});

const sampleGoal: RoadmapGoal = {
  id: 1,
  title: 'Read a Japanese novel on my own',
  deadline: '2027-06-30',
  status: 'active',
};

const sampleMilestone: Milestone = {
  id: 10,
  goal_id: 1,
  position: 1,
  title: 'Build a tiny daily reading habit',
  description: 'Read 15 minutes every day.',
  target_date: '2026-12-01',
  status: 'current',
  total_quests: 3,
  done_quests: 0,
};

const sampleTodayQuests: Quest[] = [
  {
    id: 101,
    milestone_id: 10,
    title: 'Read 2 pages of your graded reader slowly',
    due_date: '2026-11-10',
    estimated_minutes: 15,
    completed_at: null,
  },
  {
    id: 102,
    milestone_id: 10,
    title: 'Jot down 3 new vocabulary words',
    due_date: '2026-11-10',
    estimated_minutes: 10,
    completed_at: null,
  },
];

describe('DailyNote (Issue #8)', () => {
  it('renders Mochi greeting note with today quests, titles, and estimated minutes (no checkboxes)', () => {
    render(
      <BrowserRouter>
        <DailyNote
          status="quests_today"
          goal={sampleGoal}
          milestone={sampleMilestone}
          todayDate="2026-11-10"
          todayQuests={sampleTodayQuests}
        />
      </BrowserRouter>,
    );

    const noteRegion = screen.getByRole('region', { name: /a note from mochi/i });
    expect(noteRegion).toBeInTheDocument();

    const greeting = screen.getByTestId('mochi-greeting');
    expect(greeting.textContent).toMatch(/Build a tiny daily reading habit/);
    expect(greeting.textContent).toContain('♡');

    const items = screen.getAllByTestId('today-quest-item');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText(/Read 2 pages of your graded reader slowly/)).toBeInTheDocument();
    expect(within(items[0]).getByText('~15 min')).toBeInTheDocument();
    expect(within(items[1]).getByText(/Jot down 3 new vocabulary words/)).toBeInTheDocument();
    expect(within(items[1]).getByText('~10 min')).toBeInTheDocument();

    // Issue #8 does not include check-off (that's Issue #9)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('keeps the note short by showing the first few quests and a "+N more" line when many are due today', () => {
    const fiveQuests: Quest[] = [1, 2, 3, 4, 5].map((n) => ({
      id: 200 + n,
      milestone_id: 10,
      title: `Mini quest step ${n}`,
      due_date: '2026-11-10',
      estimated_minutes: 5,
      completed_at: null,
    }));

    render(
      <BrowserRouter>
        <DailyNote
          status="quests_today"
          goal={sampleGoal}
          milestone={sampleMilestone}
          todayDate="2026-11-10"
          todayQuests={fiveQuests}
        />
      </BrowserRouter>,
    );

    const items = screen.getAllByTestId('today-quest-item');
    expect(items).toHaveLength(MAX_VISIBLE_TODAY_QUESTS);
    expect(screen.getByText(/Mini quest step 1/)).toBeInTheDocument();
    expect(screen.getByText(/Mini quest step 2/)).toBeInTheDocument();
    expect(screen.getByText(/Mini quest step 3/)).toBeInTheDocument();
    expect(screen.queryByText(/Mini quest step 4/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mini quest step 5/)).not.toBeInTheDocument();

    expect(screen.getByTestId('today-quests-more')).toHaveTextContent('+2 more quests due today');
  });

  it('shows a friendly rest-day message when no quests are due today', () => {
    render(
      <BrowserRouter>
        <DailyNote
          status="rest_day"
          goal={sampleGoal}
          milestone={sampleMilestone}
          todayDate="2026-11-10"
          todayQuests={[]}
        />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('mochi-greeting').textContent).toMatch(/rest day|breather/i);
    expect(screen.getByTestId('rest-day-subcopy')).toHaveTextContent(/rest days count too/i);
    expect(screen.queryByTestId('today-quest-item')).not.toBeInTheDocument();
  });

  it('nudges the user to Talk with Mochi when there is no active goal', () => {
    render(
      <BrowserRouter>
        <DailyNote
          status="no_goal"
          goal={null}
          milestone={null}
          todayDate="2026-11-10"
          todayQuests={[]}
        />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('mochi-greeting')).toHaveTextContent(
      /we don't have an active goal yet/i,
    );
    const talkLink = screen.getByRole('link', { name: /plan a goal with mochi/i });
    expect(talkLink).toHaveAttribute('href', '/talk');
  });

  it('nudges the user to "Draw my map" when a goal exists without confirmed milestones', () => {
    render(
      <BrowserRouter>
        <DailyNote
          status="no_milestones"
          goal={sampleGoal}
          milestone={null}
          todayDate="2026-11-10"
          todayQuests={[]}
        />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('mochi-greeting')).toHaveTextContent(/draw my map/i);
    const mapLink = screen.getByRole('link', { name: /draw my map with mochi/i });
    expect(mapLink).toHaveAttribute('href', '/talk');
  });

  it('offers multiple warm template variations across different days without calling AI', () => {
    const variations = new Set(
      ['2026-11-10', '2026-11-11', '2026-11-12'].map((date) =>
        buildMochiTodayGreeting({
          status: 'quests_today',
          todayDate: date,
          milestoneTitle: 'Build a tiny daily reading habit',
          questCount: 2,
        }),
      ),
    );
    expect(variations.size).toBeGreaterThan(1);
  });
});
