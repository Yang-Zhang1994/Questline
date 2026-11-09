import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeekPlanDraft } from '@questline/shared';
import { WeekPlanPreview } from './WeekPlanPreview';

afterEach(() => {
  cleanup();
});

const sampleDraft: WeekPlanDraft = {
  week_start: '2026-11-09',
  week_end: '2026-11-15',
  quests: [
    {
      title: 'Soft review of yesterday notes',
      due_date: '2026-11-09',
      estimated_minutes: 10,
    },
    {
      title: 'Read one cozy paragraph aloud',
      due_date: '2026-11-10',
      estimated_minutes: 10,
    },
    {
      title: 'Circle three helpful words',
      due_date: '2026-11-10',
      estimated_minutes: 5,
    },
  ],
  mochi_message: "Here's a gentle week of tiny steps.",
};

describe('WeekPlanPreview (Issue #15)', () => {
  // AC: The plan is shown as a preview grouped by day before saving
  it('groups proposed quests by day with Mochi copy', () => {
    render(
      <WeekPlanPreview
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

    expect(screen.getByTestId('week-plan-preview')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /preview your week plan/i })).toBeInTheDocument();
    expect(screen.getByTestId('week-plan-day-2026-11-09')).toBeInTheDocument();
    expect(screen.getByTestId('week-plan-day-2026-11-10')).toBeInTheDocument();
    expect(screen.getByTestId('week-plan-day-2026-11-10')).toHaveTextContent(
      /Read one cozy paragraph aloud/i,
    );
    expect(screen.getByTestId('week-plan-day-2026-11-10')).toHaveTextContent(
      /Circle three helpful words/i,
    );
    expect(screen.getByTestId('week-plan-mochi-message')).toHaveTextContent(
      /gentle week of tiny steps/i,
    );
    expect(screen.getByTestId('week-plan-budget')).toHaveTextContent('20 min/day');
    expect(screen.getByTestId('week-plan-window')).toHaveTextContent('2026-11-09 → 2026-11-15');
  });

  // AC: Changes are saved only after the user confirms
  it('calls onConfirm when the user accepts the preview', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <WeekPlanPreview
        draft={sampleDraft}
        onConfirm={onConfirm}
        onRevise={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('week-plan-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // AC: User can ask Mochi for changes
  it('lets the user send revise feedback to Mochi', async () => {
    const user = userEvent.setup();
    const onRevise = vi.fn();
    render(
      <WeekPlanPreview
        draft={sampleDraft}
        onConfirm={vi.fn()}
        onRevise={onRevise}
      />,
    );

    await user.click(screen.getByTestId('week-plan-revise'));
    await user.type(screen.getByTestId('week-plan-revise-feedback'), 'lighter midweek');
    await user.click(screen.getByTestId('week-plan-revise'));
    expect(onRevise).toHaveBeenCalledWith('lighter midweek');
  });

  // AC / product: encouraging copy, no guilt
  it('keeps warm copy without guilt words in the preview message', () => {
    render(
      <WeekPlanPreview
        draft={sampleDraft}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    const message = screen.getByTestId('week-plan-mochi-message').textContent ?? '';
    expect(message.toLowerCase()).not.toMatch(/guilt|failed|behind|lazy|should have/);
    expect(message).toMatch(/gentle week/i);
  });
});
