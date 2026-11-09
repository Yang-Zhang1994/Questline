import Anthropic from '@anthropic-ai/sdk';
import type { InterviewTopic, MilestonePlanDraft } from '@questline/shared';
import {
  INTERVIEW_COMPLETE_STUB,
  MOCHI_INTERVIEW_SYSTEM_PROMPT,
  TOPIC_LABELS,
  buildAcceptedReply,
  followUpForTopic,
  questionForTopic,
} from './prompts/mochiInterview.js';
import { MOCHI_CHAT_SYSTEM_PROMPT } from './prompts/mochiChat.js';
import {
  MOCHI_MILESTONE_PLAN_SYSTEM_PROMPT,
  buildEchoMilestonePlan,
  normalizeMilestonePlan,
} from './prompts/mochiMilestonePlan.js';
import {
  type InterviewAiRequest,
  type InterviewAiResponse,
  InterviewAiResponseSchema,
} from './interviewTypes.js';
import {
  MilestonePlanDraftSchema,
  type ProposeMilestonePlanRequest,
  type ReviseMilestonePlanRequest,
} from './milestonePlanTypes.js';
import { ensureNoQuestion, ensureOneQuestion, parseModelJson } from './parse.js';

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
  evaluateInterviewAnswer(input: InterviewAiRequest): Promise<InterviewAiResponse>;
  proposeMilestonePlan(input: ProposeMilestonePlanRequest): Promise<MilestonePlanDraft>;
  reviseMilestonePlan(input: ReviseMilestonePlanRequest): Promise<MilestonePlanDraft>;
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

function looksVague(answer: string): boolean {
  const trimmed = answer.trim();
  if (trimmed.length < 12) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 3) return true;
  const vagueExact = new Set([
    'idk',
    'dunno',
    'not sure',
    'maybe',
    'whatever',
    'something',
    'stuff',
  ]);
  if (vagueExact.has(trimmed.toLowerCase())) return true;
  return false;
}

function buildInterviewUserPayload(input: InterviewAiRequest): string {
  return JSON.stringify(
    {
      current_topic: input.current_topic,
      current_topic_label: TOPIC_LABELS[input.current_topic],
      answered: input.answered,
      next_topic: input.next_topic,
      next_topic_label: input.next_topic ? TOPIC_LABELS[input.next_topic] : null,
      user_answer: input.user_answer,
      hint_question_current: questionForTopic(input.current_topic),
      hint_question_next: input.next_topic ? questionForTopic(input.next_topic) : null,
    },
    null,
    2,
  );
}

function normalizeInterviewResponse(
  raw: InterviewAiResponse,
  input: InterviewAiRequest,
): InterviewAiResponse {
  if (raw.evaluation === 'vague') {
    return {
      evaluation: 'vague',
      extracted_answer: null,
      mochi_message: ensureOneQuestion(raw.mochi_message, followUpForTopic(input.current_topic)),
    };
  }

  const extracted = (raw.extracted_answer ?? input.user_answer).trim();
  if (!input.next_topic) {
    return {
      evaluation: 'accepted',
      extracted_answer: extracted,
      mochi_message: ensureNoQuestion(raw.mochi_message || INTERVIEW_COMPLETE_STUB),
    };
  }

  return {
    evaluation: 'accepted',
    extracted_answer: extracted,
    mochi_message: ensureOneQuestion(raw.mochi_message, questionForTopic(input.next_topic)),
  };
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

    async evaluateInterviewAnswer(input: InterviewAiRequest): Promise<InterviewAiResponse> {
      if (looksVague(input.user_answer)) {
        return {
          evaluation: 'vague',
          extracted_answer: null,
          mochi_message: followUpForTopic(input.current_topic),
        };
      }
      const extracted = input.user_answer.trim();
      return {
        evaluation: 'accepted',
        extracted_answer: extracted,
        mochi_message: buildAcceptedReply(input.current_topic, input.next_topic, extracted),
      };
    },

    async proposeMilestonePlan(input: ProposeMilestonePlanRequest): Promise<MilestonePlanDraft> {
      return buildEchoMilestonePlan(input.goal, input.today);
    },

    async reviseMilestonePlan(input: ReviseMilestonePlanRequest): Promise<MilestonePlanDraft> {
      return buildEchoMilestonePlan(input.goal, input.today, input.feedback);
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

  async function completeOnce(system: string, messages: ClaudeChatTurn[]): Promise<string> {
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: 512,
      system,
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
  }

  async function planOnce(
    userContent: string,
    history: ClaudeChatTurn[] = [],
  ): Promise<MilestonePlanDraft | null> {
    const messages: ClaudeChatTurn[] = [
      ...history,
      { role: 'user', content: userContent },
    ];
    const first = await completeOnce(MOCHI_MILESTONE_PLAN_SYSTEM_PROMPT, messages);
    let parsed = parseModelJson(first, MilestonePlanDraftSchema);
    if (!parsed) {
      const retry = await completeOnce(MOCHI_MILESTONE_PLAN_SYSTEM_PROMPT, [
        ...messages,
        { role: 'assistant', content: first },
        {
          role: 'user',
          content:
            'Your previous reply was not valid JSON matching the schema. Reply again with ONLY the JSON object.',
        },
      ]);
      parsed = parseModelJson(retry, MilestonePlanDraftSchema);
    }
    return parsed;
  }

  return {
    async completeChat(messages: ClaudeChatTurn[]): Promise<string> {
      return completeOnce(MOCHI_CHAT_SYSTEM_PROMPT, messages);
    },

    async evaluateInterviewAnswer(input: InterviewAiRequest): Promise<InterviewAiResponse> {
      const payload = buildInterviewUserPayload(input);
      const messages: ClaudeChatTurn[] = [
        ...input.history,
        {
          role: 'user',
          content: `Evaluate this interview turn and reply with JSON only.\n${payload}`,
        },
      ];

      const first = await completeOnce(MOCHI_INTERVIEW_SYSTEM_PROMPT, messages);
      let parsed = parseModelJson(first, InterviewAiResponseSchema);
      if (!parsed) {
        const retry = await completeOnce(MOCHI_INTERVIEW_SYSTEM_PROMPT, [
          ...messages,
          { role: 'assistant', content: first },
          {
            role: 'user',
            content:
              'Your previous reply was not valid JSON matching the schema. Reply again with ONLY the JSON object.',
          },
        ]);
        parsed = parseModelJson(retry, InterviewAiResponseSchema);
      }
      if (!parsed) {
        throw new Error('Claude interview reply failed schema validation');
      }
      return normalizeInterviewResponse(parsed, input);
    },

    async proposeMilestonePlan(input: ProposeMilestonePlanRequest): Promise<MilestonePlanDraft> {
      const payload = JSON.stringify(
        { goal: input.goal, today: input.today },
        null,
        2,
      );
      const parsed = await planOnce(
        `Propose 3–7 ordered milestones for this confirmed goal. Reply with JSON only.\n${payload}`,
        input.history,
      );
      if (!parsed) {
        throw new Error('Claude milestone plan failed schema validation');
      }
      return normalizeMilestonePlan(parsed, input.goal, input.today);
    },

    async reviseMilestonePlan(input: ReviseMilestonePlanRequest): Promise<MilestonePlanDraft> {
      const payload = JSON.stringify(
        {
          goal: input.goal,
          previous_draft: input.previous,
          feedback: input.feedback ?? null,
          today: input.today,
        },
        null,
        2,
      );
      const parsed = await planOnce(
        `Revise this milestone plan using the goal and feedback (add/remove/rename/reorder). Reply with JSON only.\n${payload}`,
        input.history,
      );
      if (!parsed) {
        throw new Error('Claude milestone revise failed schema validation');
      }
      return normalizeMilestonePlan(parsed, input.goal, input.today);
    },
  };
}

/** Test helper — templates only, no network. */
export function createTemplateInterviewClient(
  decisions: Array<'accepted' | 'vague'> = [],
): ChatAiClient {
  let i = 0;
  const echo = createEchoChatClient();
  return {
    completeChat: echo.completeChat,
    proposeMilestonePlan: echo.proposeMilestonePlan,
    reviseMilestonePlan: echo.reviseMilestonePlan,
    async evaluateInterviewAnswer(input) {
      const forced = decisions[i++];
      if (forced === 'vague') {
        return {
          evaluation: 'vague',
          extracted_answer: null,
          mochi_message: followUpForTopic(input.current_topic),
        };
      }
      if (forced === 'accepted') {
        const extracted = input.user_answer.trim();
        return {
          evaluation: 'accepted',
          extracted_answer: extracted,
          mochi_message: buildAcceptedReply(input.current_topic, input.next_topic, extracted),
        };
      }
      return echo.evaluateInterviewAnswer(input);
    },
  };
}

export type { InterviewTopic };
