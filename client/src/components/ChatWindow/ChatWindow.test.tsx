import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, InterviewState } from '@questline/shared';
import { ChatWindow } from './ChatWindow';

afterEach(() => {
  cleanup();
});

const mochiWelcome: ChatMessage = {
  id: 1,
  user_id: 1,
  goal_id: null,
  role: 'mochi',
  content: "Hi, I'm Mochi! What would you like to start?",
  created_at: '2026-11-09T15:00:00Z',
};

const userMsg: ChatMessage = {
  id: 2,
  user_id: 1,
  goal_id: null,
  role: 'user',
  content: 'learn Japanese',
  created_at: '2026-11-09T15:01:00Z',
};

const interviewInProgress: InterviewState = {
  status: 'in_progress',
  current_topic: 'done_definition',
  answered_topics: [],
  answers: {
    done_definition: null,
    starting_point: null,
    time_budget: null,
    deadline: null,
  },
};

describe('ChatWindow (Issue #3 interview)', () => {
  it('renders distinct Mochi and user bubbles with Mochi name', () => {
    render(
      <ChatWindow
        messages={[mochiWelcome, userMsg]}
        interview={interviewInProgress}
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: /mochi messenger/i })).toBeInTheDocument();
    expect(screen.getByText(/mochi ♡/i)).toBeInTheDocument();
    expect(screen.getByText(mochiWelcome.content)).toBeInTheDocument();
    expect(screen.getByText(userMsg.content)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /mochi/i })).toBeInTheDocument();
    expect(screen.getByTestId('chat-bubble-mochi-1')).toBeInTheDocument();
    expect(screen.getByTestId('chat-bubble-user-2')).toBeInTheDocument();
  });

  it('sends via the Send button', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <ChatWindow messages={[mochiWelcome]} interview={interviewInProgress} onSend={onSend} />,
    );

    await user.type(screen.getByLabelText(/message mochi/i), 'I want to cook');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith('I want to cook');
  });

  it('sends on Enter and keeps Shift+Enter as a newline', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <ChatWindow messages={[mochiWelcome]} interview={interviewInProgress} onSend={onSend} />,
    );

    const input = screen.getByLabelText(/message mochi/i);
    await user.type(input, 'hello{Enter}');
    expect(onSend).toHaveBeenCalledWith('hello');

    onSend.mockClear();
    await user.type(input, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('line one\nline two');
  });

  it('shows a typing indicator while Mochi is responding', () => {
    render(
      <ChatWindow
        messages={[mochiWelcome]}
        interview={interviewInProgress}
        sending
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mochi-typing')).toBeInTheDocument();
    expect(screen.getByLabelText(/mochi is typing/i)).toBeInTheDocument();
  });

  it('scrolls the transcript to the bottom when messages change', async () => {
    const { rerender } = render(
      <ChatWindow messages={[mochiWelcome]} interview={interviewInProgress} onSend={vi.fn()} />,
    );
    const region = screen.getByRole('region', { name: /mochi messenger/i });
    const scroller = region.querySelector('[aria-live="polite"]') as HTMLDivElement;
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 900 });
    scroller.scrollTop = 0;

    rerender(
      <ChatWindow
        messages={[mochiWelcome, userMsg]}
        interview={interviewInProgress}
        onSend={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(scroller.scrollTop).toBe(900);
    });
  });

  // AC: app tracks which topics are answered
  it('shows interview topic progress chips', () => {
    render(
      <ChatWindow
        messages={[mochiWelcome]}
        interview={{
          ...interviewInProgress,
          answered_topics: ['done_definition'],
          current_topic: 'starting_point',
          answers: {
            ...interviewInProgress.answers,
            done_definition: 'Read a novel',
          },
        }}
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/interview progress/i)).toBeInTheDocument();
    expect(screen.getByTestId('interview-topic-done_definition')).toHaveAttribute(
      'data-state',
      'done',
    );
    expect(screen.getByTestId('interview-topic-starting_point')).toHaveAttribute(
      'data-state',
      'current',
    );
    expect(screen.getByTestId('interview-topic-time_budget')).toHaveAttribute(
      'data-state',
      'upcoming',
    );
  });

  // AC: user can restart the interview
  it('calls onRestart when Start over is clicked', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    render(
      <ChatWindow
        messages={[mochiWelcome]}
        interview={interviewInProgress}
        onSend={vi.fn()}
        onRestart={onRestart}
      />,
    );

    await user.click(screen.getByRole('button', { name: /start over/i }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('shows GoalConfirmCard when the interview is finished', () => {
    render(
      <ChatWindow
        messages={[mochiWelcome]}
        interview={{
          status: 'complete',
          current_topic: null,
          answered_topics: [
            'done_definition',
            'starting_point',
            'time_budget',
            'deadline',
          ],
          answers: {
            done_definition: 'a',
            starting_point: 'b',
            time_budget: 'c',
            deadline: 'd',
          },
        }}
        onSend={vi.fn()}
        onRestart={vi.fn()}
        goalDraft={{
          title: 'Read a Japanese novel on my own within one year',
          done_definition: 'Finish one novel',
          starting_point: 'Hiragana',
          time_budget_minutes_per_day: 20,
          deadline: '2027-11-09',
          mochi_message: 'Here is a concrete goal ♡',
        }}
        onAcceptGoal={vi.fn()}
        onReviseGoal={vi.fn()}
        onReturnToInterview={vi.fn()}
      />,
    );

    expect(screen.getByTestId('interview-complete')).toBeInTheDocument();
    expect(screen.getByTestId('goal-confirm-card')).toBeInTheDocument();
    expect(screen.getByTestId('goal-draft-title')).toHaveTextContent(/Japanese novel/i);
    expect(screen.queryByTestId('interview-complete-banner')).not.toBeInTheDocument();
  });
});
