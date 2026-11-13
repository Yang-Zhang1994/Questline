import { cleanup, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { GoalCelebration } from './GoalCelebration';

afterEach(() => {
  cleanup();
});

describe('GoalCelebration (Issue #10)', () => {
  it('celebrates the completed goal with a map link', () => {
    render(
      <BrowserRouter>
        <GoalCelebration
          goalTitle="Read a Japanese novel on my own"
          message="★ You did it! Soft paws of applause."
        />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('goal-celebration')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Read a Japanese novel/i })).toBeInTheDocument();
    expect(screen.getByText(/You did it/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /See your map/i })).toHaveAttribute('href', '/map');
  });
});
