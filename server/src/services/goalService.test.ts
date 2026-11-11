import { describe, expect, it, vi } from 'vitest';
import type { ChatAiClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import type { Goal } from '@questline/shared';
import type { InterviewRecord } from '../repositories/interviewRepository.js';
import { createGoalService } from './goalService.js';
import { AppError } from './errors.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

const completeAnswers = {
  done_definition: 'Finish one Japanese novel alone',
  starting_point: 'I know hiragana',
  time_budget: '20 minutes a day',
  deadline: 'One year from now',
};

const sampleDraft = {
  title: 'Finish one Japanese novel alone — deadline: One year from now',
  done_definition: completeAnswers.done_definition,
  starting_point: completeAnswers.starting_point,
  time_budget_minutes_per_day: 20,
  deadline: completeAnswers.deadline,
  mochi_message: 'Here is a concrete goal ♡',
};

describe('goalService (Issue #4)', () => {
  const clock = fixedClock('2026-11-09T15:00:00.000Z');

  function buildInterviewRepo(initial?: Partial<InterviewRecord>) {
    let record: InterviewRecord = {
      id: 1,
      user_id: 1,
      status: 'complete',
      current_topic: 'deadline',
      answers: completeAnswers,
      goal_draft: null,
      created_at: '2026-11-09T15:00:00.000Z',
      updated_at: '2026-11-09T15:00:00.000Z',
      ...initial,
    };

    return {
      async getForUser(userId: number) {
        return record.user_id === userId ? record : null;
      },
      async ensureForUser() {
        return record;
      },
      async saveProgress(
        _userId: number,
        patch: {
          status: InterviewRecord['status'];
          current_topic: InterviewRecord['current_topic'];
          answers: InterviewRecord['answers'];
          updatedAt: string;
        },
      ) {
        record = {
          ...record,
          status: patch.status,
          current_topic: patch.current_topic,
          answers: patch.answers,
          updated_at: patch.updatedAt,
        };
        return record;
      },
      async saveGoalDraft(_userId: number, draft: typeof sampleDraft | null, updatedAt: string) {
        record = { ...record, goal_draft: draft, updated_at: updatedAt };
        return record;
      },
      async reopenForRevise(_userId: number, updatedAt: string) {
        record = {
          ...record,
          status: 'in_progress',
          current_topic: 'done_definition',
          goal_draft: null,
          updated_at: updatedAt,
        };
        return record;
      },
      async resetForUser(_userId: number, updatedAt: string) {
        record = {
          ...record,
          status: 'in_progress',
          current_topic: 'done_definition',
          answers: {
            done_definition: null,
            starting_point: null,
            time_budget: null,
            deadline: null,
          },
          goal_draft: null,
          updated_at: updatedAt,
        };
        return record;
      },
      getRecord: () => record,
    };
  }

  function buildGoalRepo() {
    const inserted: Goal[] = [];
    return {
      inserted,
      async findActiveForUser() {
        return inserted.find((g) => g.status === 'active') ?? null;
      },
      async insertActiveFromDraft(userId: number, draft: typeof sampleDraft, createdAt: string) {
        const goal: Goal = {
          id: inserted.length + 1,
          user_id: userId,
          title: draft.title,
          done_definition: draft.done_definition,
          starting_point: draft.starting_point,
          time_budget_minutes_per_day: draft.time_budget_minutes_per_day,
          deadline: draft.deadline,
          status: 'active',
          created_at: createdAt,
        };
        inserted.push(goal);
        return goal;
      },
    };
  }

  it('proposes a draft from interview answers without inserting a goal', async () => {
    const interviews = buildInterviewRepo();
    const goals = buildGoalRepo();
    const proposeGoalDraft = vi.fn(async () => sampleDraft);
    const ai = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft,
      reviseGoalDraft: vi.fn(),
    } satisfies ChatAiClient;
    const service = createGoalService({ goals, interviews, ai, clock });

    const result = await service.proposeDraft(1);

    expect(result.draft?.title).toMatch(/Japanese novel/i);
    expect(result.draft?.time_budget_minutes_per_day).toBe(20);
    expect(proposeGoalDraft).toHaveBeenCalledTimes(1);
    expect(goals.inserted).toHaveLength(0);
    expect(interviews.getRecord().goal_draft?.title).toMatch(/Japanese novel/i);
  });

  it('revises a draft without inserting a goal', async () => {
    const interviews = buildInterviewRepo({ goal_draft: sampleDraft });
    const goals = buildGoalRepo();
    const revised = { ...sampleDraft, title: 'Read one graded Japanese novel by next November' };
    const reviseGoalDraft = vi.fn(async () => revised);
    const ai = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft,
    } satisfies ChatAiClient;
    const service = createGoalService({ goals, interviews, ai, clock });

    const result = await service.reviseDraft(1, 'Make the deadline clearer');

    expect(result.draft?.title).toMatch(/November/i);
    expect(reviseGoalDraft).toHaveBeenCalledTimes(1);
    expect(goals.inserted).toHaveLength(0);
  });

  // AC: goal saved only after explicit confirm
  it('inserts a goal only on confirm and clears the draft', async () => {
    const interviews = buildInterviewRepo({ goal_draft: sampleDraft });
    const goals = buildGoalRepo();
    const ai = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
    } satisfies ChatAiClient;
    const service = createGoalService({ goals, interviews, ai, clock });

    const result = await service.confirmDraft(1, sampleDraft);

    expect(result.goal.title).toBe(sampleDraft.title);
    expect(result.goal.deadline).toBe(sampleDraft.deadline);
    expect(result.goal.starting_point).toBe(sampleDraft.starting_point);
    expect(result.goal.time_budget_minutes_per_day).toBe(20);
    expect(goals.inserted).toHaveLength(1);
    expect(interviews.getRecord().goal_draft).toBeNull();
  });

  it('returns to the interview on revise-return and clears the draft', async () => {
    const interviews = buildInterviewRepo({ goal_draft: sampleDraft });
    const goals = buildGoalRepo();
    const ai = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
    } satisfies ChatAiClient;
    const service = createGoalService({ goals, interviews, ai, clock });

    const result = await service.returnToInterview(1);

    expect(result.interview.status).toBe('in_progress');
    expect(result.interview.current_topic).toBe('done_definition');
    expect(interviews.getRecord().goal_draft).toBeNull();
    expect(goals.inserted).toHaveLength(0);
  });

  it('rejects propose when the interview is incomplete', async () => {
    const interviews = buildInterviewRepo({
      status: 'in_progress',
      current_topic: 'done_definition',
      answers: {
        done_definition: null,
        starting_point: null,
        time_budget: null,
        deadline: null,
      },
    });
    const goals = buildGoalRepo();
    const ai = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
    } satisfies ChatAiClient;
    const service = createGoalService({ goals, interviews, ai, clock });

    await expect(service.proposeDraft(1)).rejects.toBeInstanceOf(AppError);
    expect(ai.proposeGoalDraft).not.toHaveBeenCalled();
  });
});
