import { describe, expect, it, vi } from 'vitest';
import { stubAi } from '../test/aiStub.js';
import { countQuestions } from '../ai/parse.js';
import { MOCHI_WELCOME_MESSAGE } from '../ai/prompts/mochiChat.js';
import { TOPIC_QUESTIONS } from '../ai/prompts/mochiInterview.js';
import type { Clock } from '../clock.js';
import type { InterviewRecord } from '../repositories/interviewRepository.js';
import { createChatService } from './chatService.js';
import { AppError } from './errors.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

function emptyAnswers() {
  return {
    done_definition: null as string | null,
    starting_point: null as string | null,
    time_budget: null as string | null,
    deadline: null as string | null,
  };
}

describe('chatService interview (Issue #3)', () => {
  const clock = fixedClock('2026-11-09T15:00:00.000Z');

  function buildChatRepo() {
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
      async deleteAllForUser(userId: number) {
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (rows[i].user_id === userId) rows.splice(i, 1);
        }
      },
    };
  }

  function buildInterviewRepo() {
    let record: InterviewRecord | null = null;

    return {
      async getForUser(userId: number) {
        return record?.user_id === userId ? record : null;
      },
      async ensureForUser(userId: number) {
        if (!record || record.user_id !== userId) {
          record = {
            id: 1,
            user_id: userId,
            status: 'in_progress',
            current_topic: 'done_definition',
            answers: emptyAnswers(),
            created_at: '2026-11-09T15:00:00Z',
            updated_at: '2026-11-09T15:00:00Z',
          };
        }
        return record;
      },
      async saveProgress(
        userId: number,
        patch: {
          status: InterviewRecord['status'];
          current_topic: InterviewRecord['current_topic'];
          answers: InterviewRecord['answers'];
          updatedAt: string;
        },
      ) {
        record = {
          id: record?.id ?? 1,
          user_id: userId,
          status: patch.status,
          current_topic: patch.current_topic,
          answers: patch.answers,
          created_at: record?.created_at ?? patch.updatedAt,
          updated_at: patch.updatedAt,
        };
        return record;
      },
      async resetForUser(userId: number, updatedAt: string) {
        record = {
          id: record?.id ?? 1,
          user_id: userId,
          status: 'in_progress',
          current_topic: 'done_definition',
          answers: emptyAnswers(),
          created_at: record?.created_at ?? updatedAt,
          updated_at: updatedAt,
        };
        return record;
      },
    };
  }

  it('seeds welcome + interview state when history is empty', async () => {
    const chat = buildChatRepo();
    const interviews = buildInterviewRepo();
    const ai = stubAi({
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
    });
    const service = createChatService({ chat, interviews, ai, clock });

    const result = await service.listMessages(1);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe(MOCHI_WELCOME_MESSAGE);
    expect(result.interview).toMatchObject({
      status: 'in_progress',
      current_topic: 'done_definition',
      answered_topics: [],
    });
    expect(ai.evaluateInterviewAnswer).not.toHaveBeenCalled();
  });

  // AC: Mochi asks exactly one question per message
  it('persists a single-question Mochi reply when advancing topics', async () => {
    const chat = buildChatRepo();
    const interviews = buildInterviewRepo();
    const evaluateInterviewAnswer = vi.fn(async () => ({
      evaluation: 'accepted' as const,
      extracted_answer: 'Read one Japanese novel without a dictionary',
      mochi_message: `Nice! ${TOPIC_QUESTIONS.starting_point}`,
    }));
    const ai = stubAi({ completeChat: vi.fn(), evaluateInterviewAnswer });
    const service = createChatService({ chat, interviews, ai, clock });

    await service.listMessages(1);
    const result = await service.sendMessage(
      1,
      'Read one Japanese novel without a dictionary',
    );

    expect(countQuestions(result.mochi_message.content)).toBe(1);
    expect(result.interview.answered_topics).toEqual(['done_definition']);
    expect(result.interview.current_topic).toBe('starting_point');
  });

  // AC: vague → follow-up on same topic (not skipped)
  it('asks a follow-up and keeps the same topic when the answer is vague', async () => {
    const chat = buildChatRepo();
    const interviews = buildInterviewRepo();
    const evaluateInterviewAnswer = vi.fn(async () => ({
      evaluation: 'vague' as const,
      extracted_answer: null,
      mochi_message: 'Could you paint a clearer picture of "done"?',
    }));
    const ai = stubAi({ completeChat: vi.fn(), evaluateInterviewAnswer });
    const service = createChatService({ chat, interviews, ai, clock });

    await service.listMessages(1);
    const result = await service.sendMessage(1, 'idk');

    expect(result.interview.current_topic).toBe('done_definition');
    expect(result.interview.answered_topics).toEqual([]);
    expect(countQuestions(result.mochi_message.content)).toBe(1);
    expect(evaluateInterviewAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ current_topic: 'done_definition' }),
    );
  });

  // AC: covers all four topics; tracks answered so none skipped/repeated
  it('walks all four topics without skipping or repeating', async () => {
    const chat = buildChatRepo();
    const interviews = buildInterviewRepo();
    const answers = [
      'Finish reading one Japanese novel alone',
      'Know hiragana and ~300 words',
      '20 minutes most weekdays',
      'Within one year',
    ];
    const evaluateInterviewAnswer = vi.fn(
      async (input: {
        user_answer: string;
        next_topic: keyof typeof TOPIC_QUESTIONS | null;
      }) => ({
        evaluation: 'accepted' as const,
        extracted_answer: input.user_answer,
        mochi_message: input.next_topic
          ? `Got it. ${TOPIC_QUESTIONS[input.next_topic]}`
          : 'All set — confirm card comes next ♡',
      }),
    );
    const ai = stubAi({ completeChat: vi.fn(), evaluateInterviewAnswer });
    const service = createChatService({ chat, interviews, ai, clock });

    await service.listMessages(1);

    const topicsSeen: string[] = [];
    for (const answer of answers) {
      const state = await interviews.ensureForUser(1);
      topicsSeen.push(state.current_topic);
      await service.sendMessage(1, answer);
    }

    expect(topicsSeen).toEqual([
      'done_definition',
      'starting_point',
      'time_budget',
      'deadline',
    ]);

    const final = await service.listMessages(1);
    expect(final.interview.status).toBe('complete');
    expect(final.interview.current_topic).toBeNull();
    expect(final.interview.answered_topics).toEqual([
      'done_definition',
      'starting_point',
      'time_budget',
      'deadline',
    ]);
    expect(final.interview.answers.deadline).toBe('Within one year');
  });

  // AC: user can restart from the beginning
  it('restarts the interview and clears prior messages', async () => {
    const chat = buildChatRepo();
    const interviews = buildInterviewRepo();
    const ai = stubAi({
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(async () => ({
        evaluation: 'accepted' as const,
        extracted_answer: 'done answer',
        mochi_message: `Ok! ${TOPIC_QUESTIONS.starting_point}`,
      })),
    });
    const service = createChatService({ chat, interviews, ai, clock });

    await service.listMessages(1);
    await service.sendMessage(1, 'done answer');
    const restarted = await service.restartInterview(1);

    expect(restarted.messages).toHaveLength(1);
    expect(restarted.messages[0].content).toBe(MOCHI_WELCOME_MESSAGE);
    expect(restarted.interview).toMatchObject({
      status: 'in_progress',
      current_topic: 'done_definition',
      answered_topics: [],
    });
    expect(restarted.interview.answers.done_definition).toBeNull();
  });

  it('maps Claude interview failures to AI_UNAVAILABLE', async () => {
    const chat = buildChatRepo();
    const interviews = buildInterviewRepo();
    const ai = stubAi({
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(async () => {
        throw new Error('upstream boom');
      }),
    });
    const service = createChatService({ chat, interviews, ai, clock });

    await expect(service.sendMessage(1, 'hello')).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      status: 503,
    } satisfies Partial<AppError>);
  });
});
