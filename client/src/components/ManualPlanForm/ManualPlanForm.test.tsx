import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManualPlanForm } from './ManualPlanForm';

afterEach(() => {
  cleanup();
});

describe('ManualPlanForm (Issue #21)', () => {
  // AC: Form fields — goal name, concrete goal, deadline, milestones (one per line)
  it('renders goal name, concrete goal, deadline, and milestones fields', () => {
    render(
      <ManualPlanForm onBackToChat={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByTestId('manual-plan-goal-name')).toBeInTheDocument();
    expect(screen.getByTestId('manual-plan-concrete-goal')).toBeInTheDocument();
    expect(screen.getByTestId('manual-plan-deadline')).toBeInTheDocument();
    expect(screen.getByTestId('manual-plan-milestones')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /back to chatting/i }).length).toBeGreaterThan(0);
  });

  // AC: Submitting requires a goal name and at least one milestone
  it('shows a friendly message when name or milestones are missing', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ManualPlanForm onBackToChat={vi.fn()} onSubmit={onSubmit} />);

    await user.click(screen.getByTestId('manual-plan-submit'));

    expect(screen.getByRole('alert')).toHaveTextContent(/little name/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits parsed milestone lines with the goal fields', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ManualPlanForm onBackToChat={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByTestId('manual-plan-goal-name'), 'Learn gentle yoga');
    await user.type(
      screen.getByTestId('manual-plan-concrete-goal'),
      'Flow through a 20-minute practice three days a week',
    );
    // date inputs are flaky with user.type in jsdom
    fireEvent.change(screen.getByTestId('manual-plan-deadline'), {
      target: { value: '2027-05-01' },
    });
    await user.type(
      screen.getByTestId('manual-plan-milestones'),
      'Find a soft mat\nLearn three poses\nBuild a tiny streak',
    );
    await user.click(screen.getByTestId('manual-plan-submit'));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Learn gentle yoga',
      concrete_goal: 'Flow through a 20-minute practice three days a week',
      deadline: '2027-05-01',
      milestones: ['Find a soft mat', 'Learn three poses', 'Build a tiny streak'],
    });
  });

  it('calls onBackToChat from the header link', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<ManualPlanForm onBackToChat={onBack} onSubmit={vi.fn()} />);

    await user.click(screen.getByTestId('manual-plan-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows the AI fallback notice when offered after an error', () => {
    render(
      <ManualPlanForm
        aiFallbackNotice
        onBackToChat={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByTestId('manual-plan-ai-fallback')).toHaveTextContent(/tangled/i);
  });
});
