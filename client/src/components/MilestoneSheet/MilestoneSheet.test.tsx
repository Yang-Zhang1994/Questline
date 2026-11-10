import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MilestoneSheet } from './MilestoneSheet';

afterEach(() => {
  cleanup();
});

const milestone = {
  id: 10,
  title: 'Build a tiny daily reading habit',
  description: 'Start soft',
  target_date: '2026-12-01',
  status: 'current' as const,
  position: 1,
};

const quests = [
  {
    id: 1,
    milestone_id: 10,
    title: 'Read 2 pages',
    due_date: '2026-10-28',
    estimated_minutes: 15,
    completed_at: null,
  },
];

function renderSheet(overrides: Partial<ComponentProps<typeof MilestoneSheet>> = {}) {
  const onClose = vi.fn();
  const onAdd = vi.fn().mockResolvedValue({ id: 99 });
  const onDelete = vi.fn().mockResolvedValue(true);
  render(
    <MemoryRouter>
      <MilestoneSheet
        milestone={milestone}
        quests={quests}
        doneCount={0}
        totalCount={1}
        defaultDueDate="2026-10-28"
        onClose={onClose}
        onAdd={onAdd}
        onDelete={onDelete}
        {...overrides}
      />
    </MemoryRouter>,
  );
  return { onClose, onAdd, onDelete };
}

describe('MilestoneSheet (Issue #20)', () => {
  // AC: Milestone sheet has "New quest" and "Due date" fields and an Add button
  it('shows New quest, Due date, Add, and a delete control per quest', () => {
    renderSheet();
    expect(screen.getByLabelText(/new quest/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete read 2 pages/i })).toBeInTheDocument();
  });

  // AC: Empty quest names are rejected with a friendly message
  it('rejects empty quest names with a friendly alert', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderSheet();

    await user.click(screen.getByRole('button', { name: /^add$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/little name/i);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('calls onAdd with the title and due date', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderSheet();

    await user.type(screen.getByTestId('milestone-sheet-new-quest'), 'Underline one word');
    await user.clear(screen.getByTestId('milestone-sheet-due-date'));
    await user.type(screen.getByTestId('milestone-sheet-due-date'), '2026-10-29');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    expect(onAdd).toHaveBeenCalledWith('Underline one word', '2026-10-29');
  });

  // AC: Each quest in the sheet has a ✕ button to delete it
  it('calls onDelete when ✕ is pressed', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderSheet();

    await user.click(screen.getByRole('button', { name: /delete read 2 pages/i }));
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
