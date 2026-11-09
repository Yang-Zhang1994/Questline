import type { ChatHistoryResponse, ChatMessage, SendChatMessageResponse } from '@questline/shared';
import type { ChatAiClient, ClaudeChatTurn } from '../ai/client.js';
import { MOCHI_WELCOME_MESSAGE } from '../ai/prompts/mochiChat.js';
import type { Clock } from '../clock.js';
import { toIsoDateTime } from '../clock.js';
import type { ChatRepository } from '../repositories/chatRepository.js';
import { aiUnavailable } from './errors.js';

export type ChatServiceDeps = {
  chat: ChatRepository;
  ai: ChatAiClient;
  clock: Clock;
};

function toClaudeHistory(messages: ChatMessage[]): ClaudeChatTurn[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'mochi')
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }));
}

export function createChatService(deps: ChatServiceDeps) {
  async function listMessages(userId: number): Promise<ChatHistoryResponse> {
    let messages = await deps.chat.listForUser(userId);
    if (messages.length === 0) {
      const welcome = await deps.chat.insert(
        userId,
        'mochi',
        MOCHI_WELCOME_MESSAGE,
        toIsoDateTime(deps.clock.now()),
      );
      messages = [welcome];
    }
    return { messages };
  }

  async function sendMessage(userId: number, content: string): Promise<SendChatMessageResponse> {
    // Ensure welcome exists so Claude always sees the opening turn.
    const history = (await listMessages(userId)).messages;
    const priorForClaude = toClaudeHistory(history);

    const claudeMessages: ClaudeChatTurn[] = [...priorForClaude, { role: 'user', content }];

    let mochiReply: string;
    try {
      mochiReply = await deps.ai.completeChat(claudeMessages);
    } catch {
      throw aiUnavailable();
    }

    const now = deps.clock.now();
    const userCreatedAt = toIsoDateTime(now);
    // Mochi reply is one second later so ordering stays stable if clocks collide.
    const mochiCreatedAt = toIsoDateTime(new Date(now.getTime() + 1000));

    const pair = await deps.chat.insertPair(
      userId,
      content,
      mochiReply,
      userCreatedAt,
      mochiCreatedAt,
    );

    return {
      user_message: pair.userMessage,
      mochi_message: pair.mochiMessage,
    };
  }

  return { listMessages, sendMessage };
}

export type ChatService = ReturnType<typeof createChatService>;
