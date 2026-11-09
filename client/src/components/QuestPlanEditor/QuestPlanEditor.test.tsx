import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuestPlanDraft } from '@questline/shared';
import { QuestPlanEditor } from './QuestPlanEditor';

afterEach(() => {
  cleanup();
});

const draft: QuestPlanDraft = {
  quests: [
    { title: 'Read 2 pages', due_date: '2026-11-09', estimated_minutes: 10 },
    { title: 'Write 3 new words', due_date: '2026-11-09', estimated_minutes: 10 },
    { title: 'Read 2 more pages', due_date: '2026-11-10', estimated_minutes: 15 },
  ],
  mochi_message: 'Tiny quests for your reading habit ♡',
};

const goal = {
  id: 1,
  title: 'Read a Japanese novel on my own',
  done_definition: 'Finish one short Japanese novel',
  starting_point: 'Know hiragana',
  time_budget_minutes_per_day: 20,
  deadline: '2027-11-09',
};

const milestone = {
  id: 2,
  goal_id: 1,
  position: 1,
  title: 'Build a tiny daily reading habit',
  description: 'Read a few pages each day',
  target_date: '2026-11-16',
  status: 'current' as const,
};

describe('QuestPlanEditor (Issue #7)', () => {
  // AC: each quest has a title, due date, and estimated duration
  it('shows quests grouped by due date with title and duration', () => {
    render(
      <QuestPlanEditor
        draft={draft}
        goal={goal}
        milestone={milestone}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );

    expect(screen.getByTestId('quest-plan-milestone')).toHaveTextContent(/tiny daily reading/i);
    expect(screen.getByTestId('quest-plan-budget')).toHaveTextContent('20 min/day');
    expect(screen.getByTestId('quest-draft-day-2026-11-09')).toHaveTextContent(/20 min/);
    expect(screen.getByTestId('quest-draft-item-2026-11-09-0')).toHaveTextContent(/Read 2 pages/i);
    expect(screen.getByTestId('quest-draft-item-2026-11-09-0')).toHaveTextContent(/~10 min/);
    expect(screen.getByTestId('quest-draft-mochi-message')).toHaveTextContent(/Tiny quests/i);
  });

  it('lets the user ask Mochi to edit with feedback', async () => {
    const user = userEvent.setup();
    const onRevise = vi.fn(async () => undefined);
    render(
      <QuestPlanEditor
        draft={draft}
        goal={goal}
        milestone={milestone}
        onConfirm={vi.fn()}
        onRevise={onRevise}
      />,
    );

    await user.click(screen.getByTestId('quest-revise'));
    expect(screen.getByTestId('quest-revise-feedback')).toBeInTheDocument();
    await user.type(screen.getByTestId('quest-revise-feedback'), 'Lighter Monday please');
    await user.click(screen.getByTestId('quest-revise'));
    expect(onRevise).toHaveBeenCalledWith('Lighter Monday please');
  });

  // AC: quests are saved only after the user confirms
  it('calls onConfirm when save my quests is pressed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <QuestPlanEditor
        draft={draft}
        goal={goal}
        milestone={milestone}
        onConfirm={onConfirm}
        onRevise={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('quest-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows saved quests after confirm', () => {
    render(
      <QuestPlanEditor
        draft={null}
        goal={goal}
        milestone={milestone}
        confirmedQuests={draft.quests.map((item, index) => ({
          id: index + 1,
          milestone_id: 2,
          title: item.title,
          due_date: item.due_date,
          estimated_minutes: item.estimated_minutes,
          completed_at: null,
        }))}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );

    expect(screen.getByTestId('quest-saved-list').children).toHaveLength(3);
    expect(screen.getByText(/Daily quests saved/i)).toBeInTheDocument();
  });
});
