import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TodayQuestsResponse } from '@questline/shared';
import { DailyNote } from './DailyNote';

afterEach(() => {
  cleanup();
});

const sample: TodayQuestsResponse = {
  local_date: '2026-10-28',
  goal_title: 'Read a Japanese novel on my own',
  milestone_title: 'Build a tiny daily reading habit',
  greeting: "Good afternoon! Here are today's little quests.",
  quests: [
    {
      id: 1,
      milestone_id: 2,
      title: 'Read 2 pages of your graded reader',
      due_date: '2026-10-28',
      estimated_minutes: 15,
      completed_at: null,
    },
    {
      id: 2,
      milestone_id: 2,
      title: 'Write down 3 new words you noticed',
      due_date: '2026-10-28',
      estimated_minutes: 10,
      completed_at: '2026-10-28T15:30:00Z',
    },
  ],
  overdue_quests: [],
  done_count: 1,
  total_count: 2,
  progress: {
    xp: 10,
    level: 1,
    xp_into_level: 10,
    xp_for_next_level: 50,
    current_streak: 1,
    best_streak: 1,
    last_active_date: '2026-10-28',
  },
  stamp_card: {
    card_number: 1,
    stamps_per_card: 7,
    stamped_dates: ['2026-10-28'],
    filled_count: 1,
    past_cards: [],
  },
};

describe('DailyNote (Issue #9)', () => {
  // AC: User can mark a quest as done from the daily note
  it("renders today's quests and forwards check-off from the note", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<DailyNote data={sample} onToggleQuest={onToggle} />);

    expect(screen.getByRole('region', { name: /a note from mochi/i })).toBeInTheDocument();
    expect(screen.getByText(/Today's quests · 1\/2 done/i)).toBeInTheDocument();
    expect(screen.getByText(/Current milestone/i)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: sample.quests[0].title }));
    expect(onToggle).toHaveBeenCalledWith(1, true);
  });

  // AC: Completed quests look visually distinct (checked and faded)
  it('keeps completed quests in the list in a distinct done state', () => {
    render(<DailyNote data={sample} onToggleQuest={vi.fn()} />);
    const doneBox = screen.getByRole('checkbox', {
      name: sample.quests[1].title,
    });
    expect(doneBox).toBeChecked();
    expect(doneBox.closest('li')).toHaveAttribute('data-completed', 'true');
  });

  // AC: Overdue quests are flagged; user can ask Mochi to reschedule (#14)
  it('flags overdue quests and offers a reschedule CTA', async () => {
    const user = userEvent.setup();
    const onReschedule = vi.fn();
    const withOverdue: TodayQuestsResponse = {
      ...sample,
      overdue_quests: [
        {
          id: 9,
          milestone_id: 2,
          title: 'Catch up on yesterday leftover',
          due_date: '2026-10-27',
          estimated_minutes: 10,
          completed_at: null,
        },
      ],
    };
    render(
      <DailyNote
        data={withOverdue}
        canReschedule
        onReschedule={onReschedule}
        onToggleQuest={vi.fn()}
      />,
    );

    expect(screen.getByTestId('overdue-quests')).toBeInTheDocument();
    expect(screen.getByTestId('quest-overdue-tag-9')).toHaveTextContent(/soft leftover/i);
    await user.click(screen.getByTestId('reschedule-cta'));
    expect(onReschedule).toHaveBeenCalledTimes(1);
  });
});


