import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoalCelebration } from './GoalCelebration';

afterEach(() => {
  cleanup();
});

describe('GoalCelebration (Issue #10)', () => {
  // AC: Completing the final milestone shows a goal-complete celebration screen
  it('shows a warm goal-complete celebration', () => {
    render(
      <MemoryRouter>
        <GoalCelebration
          goalTitle="Read a Japanese novel on my own"
          message="★ You did it! Mochi is so proud of this gentle journey. ♡"
          onDismiss={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('goal-celebration')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Read a Japanese novel/i })).toBeInTheDocument();
    expect(screen.getByText(/You did it/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /see your map/i })).toHaveAttribute('href', '/map');
  });
});
