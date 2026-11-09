import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@questline/shared';
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

describe('ChatWindow (Issue #2)', () => {
  // AC: Distinct user vs Mochi bubbles; Mochi name + avatar
  it('renders distinct Mochi and user bubbles with Mochi name', () => {
    render(
      <ChatWindow
        messages={[mochiWelcome, userMsg]}
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

  // AC: User types/sends with button
  it('sends via the Send button', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatWindow messages={[mochiWelcome]} onSend={onSend} />);

    await user.type(screen.getByLabelText(/message mochi/i), 'I want to cook');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith('I want to cook');
  });

  // AC: Enter sends (Shift+Enter does not)
  it('sends on Enter and keeps Shift+Enter as a newline', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatWindow messages={[mochiWelcome]} onSend={onSend} />);

    const input = screen.getByLabelText(/message mochi/i);
    await user.type(input, 'hello{Enter}');
    expect(onSend).toHaveBeenCalledWith('hello');

    onSend.mockClear();
    await user.type(input, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('line one\nline two');
  });

  // AC: typing/loading indicator
  it('shows a typing indicator while Mochi is responding', () => {
    render(<ChatWindow messages={[mochiWelcome]} sending onSend={vi.fn()} />);
    expect(screen.getByTestId('mochi-typing')).toBeInTheDocument();
    expect(screen.getByLabelText(/mochi is typing/i)).toBeInTheDocument();
  });

  // AC: auto-scroll
  it('scrolls the transcript to the bottom when messages change', async () => {
    const { rerender } = render(<ChatWindow messages={[mochiWelcome]} onSend={vi.fn()} />);
    const region = screen.getByRole('region', { name: /mochi messenger/i });
    const scroller = region.querySelector('[aria-live="polite"]') as HTMLDivElement;
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 900 });
    scroller.scrollTop = 0;

    rerender(
      <ChatWindow messages={[mochiWelcome, userMsg]} onSend={vi.fn()} />,
    );

    await waitFor(() => {
      expect(scroller.scrollTop).toBe(900);
    });
  });
});
