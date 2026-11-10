import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StageCompletePrompt } from './StageCompletePrompt';

afterEach(() => {
  cleanup();
});

describe('StageCompletePrompt (Issue #10)', () => {
  // AC: When all quests for the current milestone are done, the user is prompted to mark the stage complete
  it('prompts to mark the stage complete with encouraging copy', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <StageCompletePrompt
        milestoneTitle="Build a tiny daily reading habit"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByTestId('stage-complete-prompt')).toBeInTheDocument();
    expect(screen.getByText(/Build a tiny daily reading habit/i)).toBeInTheDocument();
    expect(screen.getByText(/every quest/i)).toBeInTheDocument();
    expect(screen.queryByText(/should have|lazy|behind|guilt/i)).not.toBeInTheDocument();

    await user.click(screen.getByTestId('stage-complete-cta'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
