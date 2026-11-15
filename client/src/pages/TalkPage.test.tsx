import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatHistoryResponse, SendChatMessageResponse } from '@questline/shared';
import { TalkPage } from './TalkPage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

const initialHistory: ChatHistoryResponse = {
  messages: [
    {
      id: 1,
      user_id: 1,
      goal_id: null,
      role: 'mochi',
      content: "Hi, I'm Mochi! What would you like to work toward?",
      created_at: '2026-11-15T10:00:00Z',
    },
  ],
  interview: {
    status: 'in_progress',
    current_topic: 'done_definition',
    answered_topics: [],
    answers: {
      done_definition: null,
      starting_point: null,
      time_budget: null,
      deadline: null,
    },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('TalkPage (optimistic chat & thinking state)', () => {
  it('shows user message immediately, clears input, shows Mochi is thinking, disables Send, and deduplicates on reply', async () => {
    const user = userEvent.setup();
    const pendingPost = deferred<Response>();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/chat/messages') && init?.method === 'POST') {
        return pendingPost.promise;
      }
      if (url.includes('/api/chat/messages')) {
        return Promise.resolve(jsonResponse(initialHistory));
      }
      return Promise.resolve(jsonResponse({ goal: null, milestones: [], quests: [] }));
    });

    render(
      <MemoryRouter initialEntries={['/talk']}>
        <TalkPage />
      </MemoryRouter>,
    );

    await screen.findByText(initialHistory.messages[0].content);

    const input = screen.getByLabelText(/message mochi/i);
    await user.type(input, 'Read a Japanese novel');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // User message appears immediately before the server responds, and input clears.
    expect(screen.getByText('Read a Japanese novel')).toBeInTheDocument();
    expect(input).toHaveValue('');

    // Thinking indicator is shown with aria-live and Send is disabled while waiting.
    const thinking = screen.getByTestId('mochi-typing');
    expect(thinking).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/mochi is thinking…/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    expect(fetchSpy.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);

    const replyPayload: SendChatMessageResponse = {
      user_message: {
        id: 2,
        user_id: 1,
        goal_id: null,
        role: 'user',
        content: 'Read a Japanese novel',
        created_at: '2026-11-15T10:01:00Z',
      },
      mochi_message: {
        id: 3,
        user_id: 1,
        goal_id: null,
        role: 'mochi',
        content: 'That sounds lovely! Where are you starting from?',
        created_at: '2026-11-15T10:01:05Z',
      },
      interview: {
        status: 'in_progress',
        current_topic: 'starting_point',
        answered_topics: ['done_definition'],
        answers: {
          done_definition: 'Read a Japanese novel',
          starting_point: null,
          time_budget: null,
          deadline: null,
        },
      },
    };

    pendingPost.resolve(jsonResponse(replyPayload));

    await screen.findByText('That sounds lovely! Where are you starting from?');
    expect(screen.queryByTestId('mochi-typing')).not.toBeInTheDocument();
    // User message is shown only once (replaced in-place with server record).
    expect(screen.getAllByText('Read a Japanese novel')).toHaveLength(1);
    expect(screen.getByTestId('chat-bubble-user-2')).toBeInTheDocument();
  });

  it('keeps the user message visible on failure, shows a friendly error, and retries without duplicating', async () => {
    const user = userEvent.setup();
    let postAttempt = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/chat/messages') && init?.method === 'POST') {
        postAttempt += 1;
        if (postAttempt === 1) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        const replyPayload: SendChatMessageResponse = {
          user_message: {
            id: 2,
            user_id: 1,
            goal_id: null,
            role: 'user',
            content: 'Learn to bake sourdough',
            created_at: '2026-11-15T10:01:00Z',
          },
          mochi_message: {
            id: 3,
            user_id: 1,
            goal_id: null,
            role: 'mochi',
            content: 'Yum! How much experience do you have so far?',
            created_at: '2026-11-15T10:01:05Z',
          },
          interview: {
            status: 'in_progress',
            current_topic: 'starting_point',
            answered_topics: ['done_definition'],
            answers: {
              done_definition: 'Learn to bake sourdough',
              starting_point: null,
              time_budget: null,
              deadline: null,
            },
          },
        };
        return Promise.resolve(jsonResponse(replyPayload));
      }
      if (url.includes('/api/chat/messages')) {
        return Promise.resolve(jsonResponse(initialHistory));
      }
      return Promise.resolve(jsonResponse({ goal: null, milestones: [], quests: [] }));
    });

    render(
      <MemoryRouter initialEntries={['/talk']}>
        <TalkPage />
      </MemoryRouter>,
    );

    await screen.findByText(initialHistory.messages[0].content);

    await user.type(screen.getByLabelText(/message mochi/i), 'Learn to bake sourdough');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't reach the server/i);
    expect(screen.getByText('Learn to bake sourdough')).toBeInTheDocument();

    await user.click(screen.getByTestId('chat-retry-button'));

    await screen.findByText('Yum! How much experience do you have so far?');
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Learn to bake sourdough')).toHaveLength(1);
    expect(postAttempt).toBe(2);
  });
});
