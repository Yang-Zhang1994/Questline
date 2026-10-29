import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Quest } from '@questline/shared';
import { QuestItem } from './QuestItem';

afterEach(() => {
  cleanup();
});

const baseQuest: Quest = {
  id: 1,
  milestone_id: 10,
  title: 'Read 2 pages of your graded reader',
  due_date: '2026-10-28',
  estimated_minutes: 15,
  completed_at: null,
};

describe('QuestItem (Issue #9)', () => {
  // AC: User can mark a quest as done from the daily note
  it('lets the user mark a quest done via the checkbox', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<QuestItem quest={baseQuest} onToggle={onToggle} />);

    await user.click(screen.getByRole('checkbox', { name: baseQuest.title }));
    expect(onToggle).toHaveBeenCalledWith(1, true);
  });

  // AC: Completed quests look visually distinct (checked and faded)
  it('shows completed quests as checked and visually faded', () => {
    const done: Quest = {
      ...baseQuest,
      completed_at: '2026-10-28T15:30:00Z',
    };
    render(<QuestItem quest={done} onToggle={vi.fn()} />);

    const checkbox = screen.getByRole('checkbox', { name: done.title });
    expect(checkbox).toBeChecked();

    const item = checkbox.closest('li');
    expect(item).toHaveAttribute('data-completed', 'true');
    expect(item?.className).toMatch(/itemDone/);
    expect(screen.getByText(/Done at/i)).toBeInTheDocument();
  });

  // AC: User can undo an accidental check-off
  it('lets the user undo a completed quest', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const done: Quest = {
      ...baseQuest,
      completed_at: '2026-10-28T15:30:00Z',
    };
    render(<QuestItem quest={done} onToggle={onToggle} />);

    await user.click(screen.getByRole('checkbox', { name: done.title }));
    expect(onToggle).toHaveBeenCalledWith(1, false);
  });
});
