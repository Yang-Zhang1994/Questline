import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Milestone, MilestoneQuestsResponse } from '@questline/shared';
import * as questsApi from '../../api/quests';
import * as localDateLib from '../../lib/localDate';
import { MilestoneSheet } from './MilestoneSheet';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleMilestone: Milestone = {
  id: 2,
  goal_id: 1,
  position: 2,
  title: 'Build a tiny daily reading habit',
  description: 'Read graded readers for 15 minutes each day.',
  target_date: '2026-12-01',
  status: 'current',
  done_quests: 1,
  total_quests: 2,
};

const sampleMilestoneQuests: MilestoneQuestsResponse = {
  milestone: {
    id: 2,
    title: 'Build a tiny daily reading habit',
    description: 'Read graded readers for 15 minutes each day.',
    target_date: '2026-12-01',
    status: 'current',
    position: 2,
    time_budget_minutes_per_day: 30,
  },
  quests: [
    {
      id: 101,
      milestone_id: 2,
      title: 'Read 2 pages slowly',
      due_date: '2026-11-10',
      estimated_minutes: 15,
      completed_at: '2026-11-10T10:00:00Z',
    },
    {
      id: 102,
      milestone_id: 2,
      title: 'Write down 3 new words',
      due_date: '2026-11-11',
      estimated_minutes: 10,
      completed_at: null,
    },
  ],
  done_count: 1,
  total_count: 2,
};

describe('MilestoneSheet (Issue #20)', () => {
  it('renders an accessible dialog, moves focus inside on open, and closes on Escape', async () => {
    vi.spyOn(localDateLib, 'todayLocalDate').mockReturnValue('2026-11-10');
    vi.spyOn(questsApi, 'fetchMilestoneQuests').mockResolvedValueOnce(sampleMilestoneQuests);

    const onClose = vi.fn();
    render(
      <MilestoneSheet
        milestone={sampleMilestone}
        timeBudgetMinutesPerDay={30}
        onClose={onClose}
      />,
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(await screen.findByText('Read 2 pages slowly')).toBeInTheDocument();
    expect(screen.getByText('Write down 3 new words')).toBeInTheDocument();

    // Focus moved inside dialog
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    // Pressing Escape closes the sheet
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has "New quest" and "Due date" fields and an Add button, rejects empty names and past dates with a friendly message, and adds a valid quest', async () => {
    vi.spyOn(localDateLib, 'todayLocalDate').mockReturnValue('2026-11-10');
    vi.spyOn(questsApi, 'fetchMilestoneQuests').mockResolvedValueOnce(sampleMilestoneQuests);
    const createSpy = vi.spyOn(questsApi, 'createQuest').mockResolvedValueOnce({
      quest: {
        id: 103,
        milestone_id: 2,
        title: 'Practice reading dialogue out loud',
        due_date: '2026-11-10',
        estimated_minutes: 25,
        completed_at: null,
      },
      daily_minutes_on_due_date: 40,
      time_budget_minutes_per_day: 30,
      over_daily_budget: true,
    });

    const onQuestsChanged = vi.fn();
    render(
      <MilestoneSheet
        milestone={sampleMilestone}
        timeBudgetMinutesPerDay={30}
        onClose={vi.fn()}
        onQuestsChanged={onQuestsChanged}
      />,
    );

    await screen.findByText('Read 2 pages slowly');

    const titleInput = screen.getByLabelText(/new quest/i);
    const dueDateInput = screen.getByLabelText(/due date/i);
    const addButton = screen.getByRole('button', { name: /^add/i });

    // 1. Submit empty/whitespace name -> rejected with friendly alert, no API call
    fireEvent.change(titleInput, { target: { value: '   ' } });
    fireEvent.click(addButton);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/quest|name/i);
    expect(createSpy).not.toHaveBeenCalled();

    // 2. Submit past date -> rejected with friendly alert, no API call
    fireEvent.change(titleInput, { target: { value: 'Practice reading dialogue out loud' } });
    fireEvent.change(dueDateInput, { target: { value: '2026-11-09' } });
    fireEvent.click(addButton);

    const dateAlert = await screen.findByRole('alert');
    expect(dateAlert.textContent).toMatch(/today|future|past|date/i);
    expect(createSpy).not.toHaveBeenCalled();

    // 3. Submit valid quest due today -> calls createQuest, appends to sheet, shows gentle daily budget note
    fireEvent.change(dueDateInput, { target: { value: '2026-11-10' } });
    fireEvent.click(addButton);

    expect(await screen.findByText('Practice reading dialogue out loud')).toBeInTheDocument();
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        milestone_id: 2,
        title: 'Practice reading dialogue out loud',
        due_date: '2026-11-10',
      }),
    );
    expect(onQuestsChanged).toHaveBeenCalled();

    // Gentle note when that day exceeds daily time budget
    expect(screen.getByText(/budget|mins|pace|gentle/i)).toBeInTheDocument();
  });

  it('renders a ✕ delete button for each quest with an accessible label, protects against accidental delete with confirmation, and removes the quest', async () => {
    vi.spyOn(localDateLib, 'todayLocalDate').mockReturnValue('2026-11-10');
    vi.spyOn(questsApi, 'fetchMilestoneQuests').mockResolvedValueOnce(sampleMilestoneQuests);
    const deleteSpy = vi.spyOn(questsApi, 'deleteQuest').mockResolvedValueOnce({
      ok: true,
      quest: sampleMilestoneQuests.quests[0],
      xp_reversed: true,
      progress: {
        xp: 0,
        level: 1,
        xp_into_level: 0,
        xp_for_next_level: 50,
        current_streak: 0,
        best_streak: 1,
        last_active_date: null,
      },
      stamp_card: {
        card_number: 1,
        stamps_per_card: 10,
        stamped_dates: [],
        filled_count: 0,
        past_cards: [],
      },
    });

    const onQuestsChanged = vi.fn();
    render(
      <MilestoneSheet
        milestone={sampleMilestone}
        timeBudgetMinutesPerDay={30}
        onClose={vi.fn()}
        onQuestsChanged={onQuestsChanged}
      />,
    );

    await screen.findByText('Read 2 pages slowly');

    const deleteBtn = screen.getByRole('button', {
      name: /delete quest:\s*read 2 pages slowly/i,
    });
    expect(deleteBtn).toHaveTextContent('✕');

    // First click reveals confirmation (does not call deleteQuest immediately)
    fireEvent.click(deleteBtn);
    expect(deleteSpy).not.toHaveBeenCalled();

    const confirmBtn = screen.getByRole('button', {
      name: /confirm delete:\s*read 2 pages slowly|^delete$/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(101, '2026-11-10');
    });
    await waitFor(() => {
      expect(screen.queryByText('Read 2 pages slowly')).not.toBeInTheDocument();
    });
    expect(onQuestsChanged).toHaveBeenCalled();
  });
});
