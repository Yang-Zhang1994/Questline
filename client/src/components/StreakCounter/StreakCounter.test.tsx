import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StreakCounter } from './StreakCounter';

afterEach(() => {
  cleanup();
});

describe('StreakCounter (Issue #12)', () => {
  // AC: The current streak and best streak are displayed
  it('shows the current streak and best streak', () => {
    render(<StreakCounter progress={{ current_streak: 4, best_streak: 9 }} />);

    expect(screen.getByTestId('streak-counter')).toBeInTheDocument();
    expect(screen.getByText(/Days in a row/i)).toBeInTheDocument();
    expect(screen.getByTestId('streak-current')).toHaveTextContent('4');
    expect(screen.getByText(/Best 9/i)).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /Days in a row: 4 current, best 9/i }),
    ).toBeInTheDocument();
  });
});
