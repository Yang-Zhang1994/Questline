import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { UserProgress } from '@questline/shared';
import { XpBar } from './XpBar';

afterEach(() => {
  cleanup();
});

const sample: UserProgress = {
  xp: 60,
  level: 2,
  xp_into_level: 10,
  xp_for_next_level: 70,
  current_streak: 0,
  best_streak: 0,
  last_active_date: null,
};

describe('XpBar (Issue #11)', () => {
  // AC: The current level and a progress bar to the next level are visible
  it('shows the current level and XP progress toward the next level', () => {
    render(<XpBar progress={sample} />);

    expect(screen.getByTestId('xp-bar')).toBeInTheDocument();
    expect(screen.getByText(/★ Lv 2/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '70');
    expect(screen.getByText(/10\/70 XP/)).toBeInTheDocument();
    expect(screen.getByTestId('xp-bar-fill')).toHaveStyle({ width: '14%' });
  });
});
