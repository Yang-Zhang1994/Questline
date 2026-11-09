import Anthropic from '@anthropic-ai/sdk';
import { MOCHI_CHAT_SYSTEM_PROMPT } from './prompts/mochiChat.js';

/** Roles Anthropic Messages API understands for conversation turns. */
export type ClaudeChatRole = 'user' | 'assistant';

export type ClaudeChatTurn = {
  role: ClaudeChatRole;
  content: string;
};

/**
 * Thin Claude wrapper. All Anthropic traffic goes through here (AGENTS.md).
 * Tests inject a fake `ChatAiClient` — never call the real API in Vitest.
 */
export type ChatAiClient = {
  completeChat(messages: ClaudeChatTurn[]): Promise<string>;
};

export type CreateClaudeClientOptions = {
  apiKey?: string;
  model?: string;
  /** Optional prebuilt SDK client (tests / DI). */
  anthropic?: Anthropic;
};

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required for Claude chat`);
  }
  return value.trim();
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && block.text.trim().length > 0) {
      parts.push(block.text.trim());
    }
  }
  return parts.join('\n\n').trim();
}

/**
 * Soft local fallback when `ANTHROPIC_API_KEY` is unset — keeps Talk demos working
 * without calling Claude. Production should set the real key; tests inject a mock.
 */
export function createEchoChatClient(): ChatAiClient {
  return {
    async completeChat(messages: ClaudeChatTurn[]): Promise<string> {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content?.trim() ?? '';
      const snippet = lastUser.length > 60 ? `${lastUser.slice(0, 57)}…` : lastUser;
      if (!snippet) {
        return "I'm here when you're ready. What dream should we turn into little quests? ♡";
      }
      return `That sounds lovely — "${snippet}". What would "done" look like for you? We'll keep steps tiny together. ♡`;
    },
  };
}

/** Production Claude client — reads `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`. */
export function createClaudeClient(options: CreateClaudeClientOptions = {}): ChatAiClient {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const model = options.model ?? process.env.ANTHROPIC_MODEL;

  if (!options.anthropic && (!apiKey || apiKey.trim().length === 0)) {
    return createEchoChatClient();
  }

  const anthropic = options.anthropic ?? new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY', apiKey) });
  const modelName = requireEnv('ANTHROPIC_MODEL', model);

  return {
    async completeChat(messages: ClaudeChatTurn[]): Promise<string> {
      const response = await anthropic.messages.create({
        model: modelName,
        max_tokens: 512,
        system: MOCHI_CHAT_SYSTEM_PROMPT,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const text = extractText(response.content);
      if (!text) {
        throw new Error('Claude returned an empty reply');
      }
      return text;
    },
  };
}
