import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StageCompletePrompt } from './StageCompletePrompt';

afterEach(() => {
  cleanup();
});

describe('StageCompletePrompt (Issue #10)', () => {
  it('shows the stage title and confirms with a green CTA', () => {
    const onConfirm = vi.fn();
    render(
      <StageCompletePrompt milestoneTitle="Build a tiny daily reading habit" onConfirm={onConfirm} />,
    );

    expect(screen.getByTestId('stage-complete-prompt')).toBeInTheDocument();
    expect(screen.getByText(/Build a tiny daily reading habit/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('stage-complete-cta'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables the CTA while busy and shows errors', () => {
    render(
      <StageCompletePrompt
        milestoneTitle="Stage"
        busy
        error="Could not mark this stage complete"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByTestId('stage-complete-cta')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Could not mark this stage complete/);
  });
});
