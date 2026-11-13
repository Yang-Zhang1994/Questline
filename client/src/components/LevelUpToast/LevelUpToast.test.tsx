import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LevelUpToast } from './LevelUpToast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LevelUpToast (Issue #11)', () => {
  // AC: Leveling up shows a short celebration animation or message from Mochi
  it('shows Mochi celebration copy when a level-up message is provided', () => {
    render(
      <LevelUpToast message="★ Level 2! Mochi is hopping with joy — you're growing so gently. ♡" />,
    );

    expect(screen.getByTestId('level-up-toast')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Level 2/);
    expect(screen.getByRole('img', { name: /Mochi/i })).toBeInTheDocument();
  });

  it('renders nothing when message is null', () => {
    const { container } = render(<LevelUpToast message={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
