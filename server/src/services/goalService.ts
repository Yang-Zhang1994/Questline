import type {
  ActivateGoalResponse,
  ConfirmGoalResponse,
  DeleteGoalResponse,
  GoalDraft,
  GoalDraftResponse,
  GoalsListResponse,
  InterviewAnswers,
  ManualPlanBody,
  ManualPlanResponse,
  RestartInterviewResponse,
  StartNewGoalResponse,
} from '@questline/shared';
import type { ChatAiClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import { formatLocalDate, toIsoDateTime } from '../clock.js';
import type { GoalRepository } from '../repositories/goalRepository.js';
import {
  toInterviewState,
  type InterviewRepository,
} from '../repositories/interviewRepository.js';
import { aiUnavailable, conflict, notFound, validationError } from './errors.js';

export type GoalServiceDeps = {
  goals: GoalRepository;
  interviews: InterviewRepository;
  ai: ChatAiClient;
  clock: Clock;
  /** Reuse Issue #3 restart so "＋ New goal" clears chat + interview (#18). */
  restartInterview: (userId: number) => Promise<RestartInterviewResponse>;
};

function answersComplete(answers: InterviewAnswers): boolean {
  return (
    Boolean(answers.done_definition?.trim()) &&
    Boolean(answers.starting_point?.trim()) &&
    Boolean(answers.time_budget?.trim()) &&
    Boolean(answers.deadline?.trim())
  );
}

/** Spread milestone target dates from ~today toward the deadline (inclusive). */
function targetDatesForMilestones(
  count: number,
  deadline: string | null,
  todayIso: string,
): Array<string | null> {
  if (!deadline || deadline < todayIso) {
    return Array.from({ length: count }, () => null);
  }
  if (count === 1) return [deadline];

  const start = Date.parse(`${todayIso}T12:00:00Z`);
  const end = Date.parse(`${deadline}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return Array.from({ length: count }, () => deadline);
  }

  const span = end - start;
  return Array.from({ length: count }, (_, index) => {
    const t = start + Math.round((span * (index + 1)) / count);
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
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

  async function listPayload(userId: number): Promise<GoalsListResponse> {
    const goals = await deps.goals.listSelectableForUser(userId);
    const active = goals.find((g) => g.status === 'active') ?? null;
    return {
      goals,
      active_goal_id: active?.id ?? null,
    };
  }

  async function listGoals(userId: number): Promise<GoalsListResponse> {
    return listPayload(userId);
  }

  async function activateGoal(
    userId: number,
    goalId: number,
  ): Promise<ActivateGoalResponse> {
    let goal;
    try {
      goal = await deps.goals.activateForUser(goalId, userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'GOAL_NOT_FOUND') {
        throw notFound('That goal was not found on your diary ♡');
      }
      if (message === 'GOAL_ARCHIVED') {
        throw validationError('That goal was archived — pick another from your list ♡');
      }
      throw err;
    }

    const listed = await listPayload(userId);
    return {
      goal,
      goals: listed.goals,
      active_goal_id: goal.id,
    };
  }

  /**
   * Pause the current active goal (kept in the selector) and restart the
   * interview so Mochi can draft a brand-new goal without deleting others.
   */
  async function startNewGoal(userId: number): Promise<StartNewGoalResponse> {
    const paused = await deps.goals.pauseActiveForUser(userId);
    await deps.restartInterview(userId);
    const listed = await listPayload(userId);
    return {
      paused_goal_id: paused?.id ?? null,
      goals: listed.goals,
      active_goal_id: listed.active_goal_id,
    };
  }

  async function deleteGoal(userId: number, goalId: number): Promise<DeleteGoalResponse> {
    try {
      await deps.goals.deleteForUser(goalId, userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'GOAL_NOT_FOUND') {
        throw notFound('That goal was not found on your diary ♡');
      }
      throw err;
    }

    const listed = await listPayload(userId);
    return {
      deleted_goal_id: goalId,
      goals: listed.goals,
      active_goal_id: listed.active_goal_id,
    };
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
        throw conflict('You already have an active goal — pause it before starting a new one.');
      }
      throw err;
    }

    // Clear draft so reload does not re-offer the same confirm card.
    await deps.interviews.saveGoalDraft(userId, null, toIsoDateTime(deps.clock.now()));

    return { goal };
  }

  /**
   * Manual form fallback (#21): user types goal + milestones; submit persists
   * both (no AI draft). Prior active goal is paused so the selector keeps it.
   */
  async function createManualPlan(
    userId: number,
    body: ManualPlanBody,
  ): Promise<ManualPlanResponse> {
    const title = body.title.trim();
    const milestoneTitles = body.milestones.map((m) => m.trim()).filter((m) => m.length > 0);

    if (!title) {
      throw validationError('Give your goal a little name before we save it ♡');
    }
    if (milestoneTitles.length === 0) {
      throw validationError(
        'Add at least one milestone (one per line) so we can draw your map ♡',
      );
    }

    const now = deps.clock.now();
    const today = formatLocalDate(now);
    const deadline = body.deadline ?? null;
    const dates = targetDatesForMilestones(milestoneTitles.length, deadline, today);

    return deps.goals.createManualPlan(userId, {
      title,
      concrete_goal: body.concrete_goal ?? null,
      deadline,
      createdAt: toIsoDateTime(now),
      milestones: milestoneTitles.map((milestoneTitle, index) => ({
        position: index + 1,
        title: milestoneTitle,
        description: 'You wrote this stage by hand ♡',
        target_date: dates[index] ?? null,
      })),
    });
  }

  return {
    listGoals,
    activateGoal,
    startNewGoal,
    deleteGoal,
    createManualPlan,
    getDraft,
    proposeDraft,
    reviseDraft,
    returnToInterview,
    confirmDraft,
  };
}

export type GoalService = ReturnType<typeof createGoalService>;
