import type {
  ConfirmGoalResponse,
  GoalDraft,
  GoalDraftResponse,
  InterviewAnswers,
} from '@questline/shared';
import type { ChatAiClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import { toIsoDateTime } from '../clock.js';
import type { GoalRepository } from '../repositories/goalRepository.js';
import {
  toInterviewState,
  type InterviewRepository,
} from '../repositories/interviewRepository.js';
import { aiUnavailable, conflict, validationError } from './errors.js';

export type GoalServiceDeps = {
  goals: GoalRepository;
  interviews: InterviewRepository;
  ai: ChatAiClient;
  clock: Clock;
};

function answersComplete(answers: InterviewAnswers): boolean {
  return (
    Boolean(answers.done_definition?.trim()) &&
    Boolean(answers.starting_point?.trim()) &&
    Boolean(answers.time_budget?.trim()) &&
    Boolean(answers.deadline?.trim())
  );
}

export function createGoalService(deps: GoalServiceDeps) {
  async function requireCompleteInterview(userId: number) {
    const interview = await deps.interviews.ensureForUser(userId);
    if (interview.status !== 'complete' || !answersComplete(interview.answers)) {
      throw validationError(
        'Finish the goal interview with Mochi first — then we can draft a concrete goal ♡',
      );
    }
    return interview;
  }

  async function getDraft(userId: number): Promise<GoalDraftResponse> {
    const interview = await deps.interviews.ensureForUser(userId);
    const active = await deps.goals.findActiveForUser(userId);

    if (interview.status !== 'complete') {
      return { draft: null, confirmed: false, goal: null };
    }

    if (interview.goal_draft) {
      return { draft: interview.goal_draft, confirmed: false, goal: active };
    }

    return { draft: null, confirmed: Boolean(active), goal: active };
  }

  async function proposeDraft(userId: number): Promise<GoalDraftResponse> {
    const interview = await requireCompleteInterview(userId);

    if (interview.goal_draft) {
      return { draft: interview.goal_draft, confirmed: false, goal: null };
    }

    let draft: GoalDraft;
    try {
      draft = await deps.ai.proposeGoalDraft({ answers: interview.answers });
    } catch {
      throw aiUnavailable();
    }

    const saved = await deps.interviews.saveGoalDraft(
      userId,
      draft,
      toIsoDateTime(deps.clock.now()),
    );

    return { draft: saved.goal_draft, confirmed: false, goal: null };
  }

  async function reviseDraft(
    userId: number,
    feedback?: string,
  ): Promise<GoalDraftResponse> {
    const interview = await requireCompleteInterview(userId);
    const previous = interview.goal_draft;
    if (!previous) {
      throw validationError('Ask Mochi for a goal draft first, then we can revise it ♡');
    }

    let draft: GoalDraft;
    try {
      draft = await deps.ai.reviseGoalDraft({
        answers: interview.answers,
        previous,
        feedback,
      });
    } catch {
      throw aiUnavailable();
    }

    const saved = await deps.interviews.saveGoalDraft(
      userId,
      draft,
      toIsoDateTime(deps.clock.now()),
    );

    return { draft: saved.goal_draft, confirmed: false, goal: null };
  }

  /**
   * Revise path that returns to the interview (assignment): clear draft, reopen topics,
   * keep prior answers so the user can tweak them with Mochi.
   */
  async function returnToInterview(userId: number): Promise<{
    interview: ReturnType<typeof toInterviewState>;
  }> {
    const interview = await deps.interviews.ensureForUser(userId);
    if (interview.status !== 'complete') {
      throw validationError('The interview is already open — keep chatting with Mochi ♡');
    }
    const reopened = await deps.interviews.reopenForRevise(
      userId,
      toIsoDateTime(deps.clock.now()),
    );
    return { interview: toInterviewState(reopened) };
  }

  async function confirmDraft(userId: number, draft: GoalDraft): Promise<ConfirmGoalResponse> {
    await requireCompleteInterview(userId);

    // Confirm-before-save: only persist when the client Accepts an explicit draft.
    if (!draft.starting_point.trim() || !draft.deadline.trim()) {
      throw validationError('A confirmed goal needs a starting point and a deadline ♡');
    }

    let goal;
    try {
      goal = await deps.goals.insertActiveFromDraft(
        userId,
        draft,
        toIsoDateTime(deps.clock.now()),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/idx_goals_one_active_per_user|unique/i.test(message)) {
        throw conflict('You already have an active goal — archive it before starting a new one.');
      }
      throw err;
    }

    // Clear draft so reload does not re-offer the same confirm card.
    await deps.interviews.saveGoalDraft(userId, null, toIsoDateTime(deps.clock.now()));

    return { goal };
  }

  return {
    getDraft,
    proposeDraft,
    reviseDraft,
    returnToInterview,
    confirmDraft,
  };
}

export type GoalService = ReturnType<typeof createGoalService>;
