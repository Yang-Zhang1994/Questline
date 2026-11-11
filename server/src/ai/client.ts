import Anthropic from '@anthropic-ai/sdk';
import {
  MilestonePlanAiResponseSchema,
  createMilestoneProposalListSchema,
  type InterviewTopic,
  type MilestonePlanAiResponse,
} from '@questline/shared';
import {
  type GoalDraft,
  type ProposeGoalDraftRequest,
  type ReviseGoalDraftRequest,
  GoalDraftSchema,
} from './goalDraftTypes.js';
import {
  INTERVIEW_COMPLETE_STUB,
  MOCHI_INTERVIEW_SYSTEM_PROMPT,
  TOPIC_LABELS,
  buildAcceptedReply,
  followUpForTopic,
  questionForTopic,
} from './prompts/mochiInterview.js';
import {
  MOCHI_GOAL_DRAFT_SYSTEM_PROMPT,
  buildEchoGoalDraft,
  parseTimeBudgetMinutes,
} from './prompts/mochiGoalDraft.js';
import { MOCHI_CHAT_SYSTEM_PROMPT } from './prompts/mochiChat.js';
import {
  MOCHI_MILESTONES_SYSTEM_PROMPT,
  buildDefaultMilestoneProposal,
  buildMilestoneUserPayload,
  type MilestonePlanAiRequest,
} from './prompts/mochiMilestones.js';
import {
  type InterviewAiRequest,
  type InterviewAiResponse,
  InterviewAiResponseSchema,
} from './interviewTypes.js';
import {
  ensureNoQuestion,
  ensureOneQuestion,
  parseModelJson,
  parseTimeBudgetAnswer,
  z,
} from './parse.js';

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
  proposeGoalDraft(input: ProposeGoalDraftRequest): Promise<GoalDraft>;
  reviseGoalDraft(input: ReviseGoalDraftRequest): Promise<GoalDraft>;
  proposeMilestones?(input: MilestonePlanAiRequest): Promise<MilestonePlanAiResponse>;
};

function normalizeGoalDraft(raw: GoalDraft, answers: ProposeGoalDraftRequest['answers']): GoalDraft {
  return {
    title: raw.title.trim(),
    done_definition: raw.done_definition.trim() || (answers.done_definition ?? raw.title).trim(),
    starting_point: raw.starting_point.trim() || (answers.starting_point ?? 'where I am today').trim(),
    time_budget_minutes_per_day:
      raw.time_budget_minutes_per_day > 0
        ? raw.time_budget_minutes_per_day
        : parseTimeBudgetMinutes(answers.time_budget),
    deadline: raw.deadline.trim() || (answers.deadline ?? 'within a year').trim(),
    mochi_message: ensureNoQuestion(raw.mochi_message),
  };
}

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

function looksVague(answer: string, topic?: InterviewTopic): boolean {
  const trimmed = answer.trim();
  // Compact time answers (`10h/week`, `100`, `skip`) are valid for time_budget.
  if (topic === 'time_budget' && parseTimeBudgetAnswer(trimmed)) {
    return false;
  }
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

/** Deterministic accept when the time-budget answer parses, even if Claude said vague. */
function acceptedTimeBudgetReply(
  input: InterviewAiRequest,
  parsed: NonNullable<ReturnType<typeof parseTimeBudgetAnswer>>,
): InterviewAiResponse {
  return {
    evaluation: 'accepted',
    extracted_answer: parsed.display,
    mochi_message: buildAcceptedReply(input.current_topic, input.next_topic, parsed.display),
  };
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
    if (input.current_topic === 'time_budget') {
      const parsed = parseTimeBudgetAnswer(input.user_answer);
      if (parsed) return acceptedTimeBudgetReply(input, parsed);
    }
    return {
      evaluation: 'vague',
      extracted_answer: null,
      mochi_message: ensureOneQuestion(raw.mochi_message, followUpForTopic(input.current_topic)),
    };
  }

  let extracted = (raw.extracted_answer ?? input.user_answer).trim();
  if (input.current_topic === 'time_budget') {
    const parsed = parseTimeBudgetAnswer(input.user_answer);
    if (parsed) extracted = parsed.display;
  }

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
      if (input.current_topic === 'time_budget') {
        const parsed = parseTimeBudgetAnswer(input.user_answer);
        if (parsed) return acceptedTimeBudgetReply(input, parsed);
      }
      if (looksVague(input.user_answer, input.current_topic)) {
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

    async proposeGoalDraft(input: ProposeGoalDraftRequest): Promise<GoalDraft> {
      return buildEchoGoalDraft(input.answers);
    },

    async reviseGoalDraft(input: ReviseGoalDraftRequest): Promise<GoalDraft> {
      return buildEchoGoalDraft(input.answers, input.feedback);
    },

    async proposeMilestones(input: MilestonePlanAiRequest): Promise<MilestonePlanAiResponse> {
      return buildDefaultMilestoneProposal(input);
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

  async function completeOnce(
    system: string,
    messages: ClaudeChatTurn[],
    maxTokens = 512,
  ): Promise<string> {
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: maxTokens,
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

  async function draftOnce(
    userContent: string,
    history: ClaudeChatTurn[] = [],
  ): Promise<GoalDraft | null> {
    const messages: ClaudeChatTurn[] = [
      ...history,
      { role: 'user', content: userContent },
    ];
    const first = await completeOnce(MOCHI_GOAL_DRAFT_SYSTEM_PROMPT, messages);
    let parsed = parseModelJson(first, GoalDraftSchema);
    if (!parsed) {
      const retry = await completeOnce(MOCHI_GOAL_DRAFT_SYSTEM_PROMPT, [
        ...messages,
        { role: 'assistant', content: first },
        {
          role: 'user',
          content:
            'Your previous reply was not valid JSON matching the schema. Reply again with ONLY the JSON object.',
        },
      ]);
      parsed = parseModelJson(retry, GoalDraftSchema);
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

    async proposeGoalDraft(input: ProposeGoalDraftRequest): Promise<GoalDraft> {
      const payload = JSON.stringify({ answers: input.answers }, null, 2);
      const parsed = await draftOnce(
        `Propose one measurable goal from these interview answers. Reply with JSON only.\n${payload}`,
        input.history,
      );
      if (!parsed) {
        throw new Error('Claude goal draft failed schema validation');
      }
      return normalizeGoalDraft(parsed, input.answers);
    },

    async reviseGoalDraft(input: ReviseGoalDraftRequest): Promise<GoalDraft> {
      const payload = JSON.stringify(
        {
          answers: input.answers,
          previous_draft: input.previous,
          feedback: input.feedback ?? null,
        },
        null,
        2,
      );
      const parsed = await draftOnce(
        `Revise this goal draft using the interview answers and feedback. Reply with JSON only.\n${payload}`,
        input.history,
      );
      if (!parsed) {
        throw new Error('Claude goal revise failed schema validation');
      }
      return normalizeGoalDraft(parsed, input.answers);
    },

    async proposeMilestones(input: MilestonePlanAiRequest): Promise<MilestonePlanAiResponse> {
      const payload = buildMilestoneUserPayload(input);
      const messages: ClaudeChatTurn[] = [
        ...(input.history ?? []),
        {
          role: 'user',
          content: `Propose or adjust the milestone plan and reply with JSON only.\n${payload}`,
        },
      ];

      const schema = MilestonePlanAiResponseSchema.extend({
        milestones: createMilestoneProposalListSchema(input.goal.deadline),
      }) satisfies z.ZodType<MilestonePlanAiResponse>;

      const first = await completeOnce(MOCHI_MILESTONES_SYSTEM_PROMPT, messages, 1024);
      let parsed = parseModelJson(first, schema);
      if (!parsed) {
        const retry = await completeOnce(
          MOCHI_MILESTONES_SYSTEM_PROMPT,
          [
            ...messages,
            { role: 'assistant', content: first },
            {
              role: 'user',
              content:
                'Your previous reply was not valid JSON matching the milestone schema (3–7 ordered milestones with target_date before the goal deadline). Reply again with ONLY the JSON object.',
            },
          ],
          1024,
        );
        parsed = parseModelJson(retry, schema);
      }
      if (!parsed) {
        throw new Error('Claude milestone proposal failed schema validation');
      }
      return parsed;
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
    proposeGoalDraft: echo.proposeGoalDraft,
    reviseGoalDraft: echo.reviseGoalDraft,
    proposeMilestones: echo.proposeMilestones,
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

export type { InterviewTopic, MilestonePlanAiRequest, MilestonePlanAiResponse };
