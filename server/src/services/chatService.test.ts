import { describe, expect, it, vi } from 'vitest';
import type { ChatAiClient } from '../ai/client.js';
import { MOCHI_WELCOME_MESSAGE } from '../ai/prompts/mochiChat.js';
import type { Clock } from '../clock.js';
import { createChatService } from './chatService.js';
import { AppError } from './errors.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

describe('chatService (Issue #2)', () => {
  const clock = fixedClock('2026-11-09T15:00:00.000Z');

  function buildRepo() {
    let nextId = 1;
    const rows: Array<{
      id: number;
      user_id: number;
      goal_id: number | null;
      role: 'user' | 'mochi';
      content: string;
      created_at: string;
    }> = [];

    return {
      async listForUser(userId: number) {
        return rows.filter((r) => r.user_id === userId);
      },
      async insert(
        userId: number,
        role: 'user' | 'mochi',
        content: string,
        createdAt: string,
        goalId: number | null = null,
      ) {
        const row = {
          id: nextId++,
          user_id: userId,
          goal_id: goalId,
          role,
          content,
          created_at: createdAt,
        };
        rows.push(row);
        return row;
      },
      async insertPair(
        userId: number,
        userContent: string,
        mochiContent: string,
        userCreatedAt: string,
        mochiCreatedAt: string,
        goalId: number | null = null,
      ) {
        const userMessage = await this.insert(userId, 'user', userContent, userCreatedAt, goalId);
        const mochiMessage = await this.insert(
          userId,
          'mochi',
          mochiContent,
          mochiCreatedAt,
          goalId,
        );
        return { userMessage, mochiMessage };
      },
    };
  }

  it('seeds a welcome Mochi message when history is empty', async () => {
    const chat = buildRepo();
    const ai: ChatAiClient = { completeChat: vi.fn() };
    const service = createChatService({ chat, ai, clock });

    const result = await service.listMessages(1);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('mochi');
    expect(result.messages[0].content).toBe(MOCHI_WELCOME_MESSAGE);
    expect(ai.completeChat).not.toHaveBeenCalled();
  });

  it('sends full history (welcome + prior turns) to Claude and persists both sides', async () => {
    const chat = buildRepo();
    const completeChat = vi.fn(async () => 'Soft reply from Mochi ♡');
    const ai: ChatAiClient = { completeChat };
    const service = createChatService({ chat, ai, clock });

    await service.listMessages(1);
    const result = await service.sendMessage(1, 'I want to learn Japanese');

    expect(completeChat).toHaveBeenCalledTimes(1);
    expect(completeChat).toHaveBeenCalledWith([
      { role: 'assistant', content: MOCHI_WELCOME_MESSAGE },
      { role: 'user', content: 'I want to learn Japanese' },
    ]);

    expect(result.user_message.content).toBe('I want to learn Japanese');
    expect(result.mochi_message.content).toBe('Soft reply from Mochi ♡');
    expect(result.user_message.role).toBe('user');
    expect(result.mochi_message.role).toBe('mochi');
  });

  it('maps Claude failures to a friendly AI_UNAVAILABLE error', async () => {
    const chat = buildRepo();
    const ai: ChatAiClient = {
      completeChat: vi.fn(async () => {
        throw new Error('upstream boom');
      }),
    };
    const service = createChatService({ chat, ai, clock });

    await expect(service.sendMessage(1, 'hello')).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      status: 503,
    } satisfies Partial<AppError>);
  });
});
