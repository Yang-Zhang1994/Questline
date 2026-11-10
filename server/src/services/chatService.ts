import type {
  ChatHistoryResponse,
  ChatMessage,
  InterviewAnswers,
  InterviewStatus,
  InterviewTopic,
  RestartInterviewResponse,
  SendChatMessageResponse,
} from '@questline/shared';
import type { ChatAiClient, ClaudeChatTurn } from '../ai/client.js';
import { countQuestions } from '../ai/parse.js';
import { MOCHI_WELCOME_MESSAGE } from '../ai/prompts/mochiChat.js';
import {
  INTERVIEW_COMPLETE_STUB,
  followUpForTopic,
  nextTopicAfter,
  questionForTopic,
} from '../ai/prompts/mochiInterview.js';
import type { Clock } from '../clock.js';
import { toIsoDateTime } from '../clock.js';
import type { ChatRepository } from '../repositories/chatRepository.js';
import {
  toInterviewState,
  type InterviewRepository,
} from '../repositories/interviewRepository.js';
import { aiUnavailable } from './errors.js';

export type ChatServiceDeps = {
  chat: ChatRepository;
  interviews: InterviewRepository;
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

function emptyAnswers(): InterviewAnswers {
  return {
    done_definition: null,
    starting_point: null,
    time_budget: null,
    deadline: null,
  };
}

function withAnswer(
  answers: InterviewAnswers,
  topic: InterviewTopic,
  value: string,
): InterviewAnswers {
  return { ...answers, [topic]: value };
}

export function createChatService(deps: ChatServiceDeps) {
  async function listMessages(userId: number): Promise<ChatHistoryResponse> {
    const interviewRecord = await deps.interviews.ensureForUser(userId);
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
    return {
      messages,
      interview: toInterviewState(interviewRecord),
    };
  }

  async function sendMessage(userId: number, content: string): Promise<SendChatMessageResponse> {
    const history = (await listMessages(userId)).messages;
    let interview = await deps.interviews.ensureForUser(userId);
    const priorForClaude = toClaudeHistory(history);

    // Interview already complete — soft chat keeps working; GoalConfirmCard is #4.
    if (interview.status === 'complete') {
      let mochiReply: string;
      try {
        mochiReply = await deps.ai.completeChat([
          ...priorForClaude,
          { role: 'user', content },
        ]);
      } catch {
        throw aiUnavailable();
      }

      const now = deps.clock.now();
      const pair = await deps.chat.insertPair(
        userId,
        content,
        mochiReply,
        toIsoDateTime(now),
        toIsoDateTime(new Date(now.getTime() + 1000)),
      );

      return {
        user_message: pair.userMessage,
        mochi_message: pair.mochiMessage,
        interview: toInterviewState(interview),
      };
    }

    const currentTopic = interview.current_topic;
    const nextTopic = nextTopicAfter(currentTopic);

    let evaluation;
    try {
      evaluation = await deps.ai.evaluateInterviewAnswer({
        history: priorForClaude,
        current_topic: currentTopic,
        answered: interview.answers,
        user_answer: content,
        next_topic: nextTopic,
      });
    } catch {
      throw aiUnavailable();
    }

    let mochiMessage = evaluation.mochi_message;
    let nextAnswers = interview.answers;
    let nextStatus: InterviewStatus = interview.status;
    let nextCurrentTopic: InterviewTopic = currentTopic;

    if (evaluation.evaluation === 'accepted') {
      const extracted = (evaluation.extracted_answer ?? content).trim();
      nextAnswers = withAnswer(interview.answers, currentTopic, extracted);
      if (nextTopic) {
        nextCurrentTopic = nextTopic;
        // AC: exactly one question while interview continues.
        if (countQuestions(mochiMessage) !== 1) {
          mochiMessage = `Got it — ${extracted}. ${questionForTopic(nextTopic)}`;
        }
      } else {
        nextStatus = 'complete';
        if (countQuestions(mochiMessage) !== 0) {
          mochiMessage = INTERVIEW_COMPLETE_STUB;
        }
      }
    } else {
      // Stay on the same topic; enforce a single follow-up question.
      if (countQuestions(mochiMessage) !== 1) {
        mochiMessage = followUpForTopic(currentTopic);
      }
    }

    const now = deps.clock.now();
    const userCreatedAt = toIsoDateTime(now);
    const mochiCreatedAt = toIsoDateTime(new Date(now.getTime() + 1000));
    const updatedAt = mochiCreatedAt;

    interview = await deps.interviews.saveProgress(userId, {
      status: nextStatus,
      current_topic: nextCurrentTopic,
      answers: nextAnswers,
      updatedAt,
    });

    const pair = await deps.chat.insertPair(
      userId,
      content,
      mochiMessage,
      userCreatedAt,
      mochiCreatedAt,
    );

    return {
      user_message: pair.userMessage,
      mochi_message: pair.mochiMessage,
      interview: toInterviewState(interview),
    };
  }

  async function restartInterview(userId: number): Promise<RestartInterviewResponse> {
    const now = toIsoDateTime(deps.clock.now());
    await deps.chat.deleteAllForUser(userId);
    const interview = await deps.interviews.resetForUser(userId, now);
    const welcome = await deps.chat.insert(userId, 'mochi', MOCHI_WELCOME_MESSAGE, now);
    return {
      messages: [welcome],
      interview: toInterviewState(interview),
    };
  }

  return { listMessages, sendMessage, restartInterview };
}

export type ChatService = ReturnType<typeof createChatService>;

/** Exported for tests that need a blank answer bag. */
export { emptyAnswers };
