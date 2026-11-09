import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RescheduleDraft } from '@questline/shared';
import { ReschedulePreview } from './ReschedulePreview';

afterEach(() => {
  cleanup();
});

const sampleDraft: RescheduleDraft = {
  moves: [
    {
      quest_id: 11,
      title: 'Read 2 pages of your graded reader',
      from_date: '2026-11-05',
      to_date: '2026-11-09',
      estimated_minutes: 10,
    },
    {
      quest_id: 12,
      title: 'Write down 3 new words',
      from_date: '2026-11-06',
      to_date: '2026-11-10',
      estimated_minutes: 10,
    },
  ],
  mochi_message: "Let's adjust the plan together.",
};

describe('ReschedulePreview (Issue #14)', () => {
  // AC: The proposed schedule is shown as a preview
  it('shows each overdue quest with from → to dates and Mochi copy', () => {
    render(
      <ReschedulePreview
        draft={sampleDraft}
        milestone={{
          id: 2,
          goal_id: 1,
          position: 1,
          title: 'Build a tiny daily reading habit',
          description: null,
          target_date: '2026-11-16',
          status: 'current',
        }}
        goal={{
          id: 1,
          title: 'Read a Japanese novel',
          done_definition: null,
          starting_point: null,
          time_budget_minutes_per_day: 20,
          deadline: null,
        }}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );

    expect(screen.getByTestId('reschedule-preview')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /preview your reschedule/i })).toBeInTheDocument();
    expect(screen.getByTestId('reschedule-mochi-message')).toHaveTextContent(
      /Let's adjust the plan together/i,
    );
    expect(screen.getByTestId('reschedule-from-11')).toHaveTextContent('2026-11-05');
    expect(screen.getByTestId('reschedule-to-11')).toHaveTextContent('2026-11-09');
    expect(screen.getByTestId('reschedule-budget')).toHaveTextContent('20 min/day');
  });

  // AC: Changes are saved only after the user confirms
  it('calls onConfirm when the user accepts the preview', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ReschedulePreview
        draft={sampleDraft}
        onConfirm={onConfirm}
        onRevise={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('reschedule-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // AC: Mochi's message is encouraging, with no guilt-inducing wording
  it('keeps warm copy without guilt words in the preview message', () => {
    render(
      <ReschedulePreview
        draft={sampleDraft}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    const message = screen.getByTestId('reschedule-mochi-message').textContent ?? '';
    expect(message.toLowerCase()).not.toMatch(/guilt|failed|behind|lazy|should have/);
    expect(message).toMatch(/adjust the plan together/i);
  });
});
