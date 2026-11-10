import type {
  ActivateGoalResponse,
  DeleteGoalResponse,
  GoalsListResponse,
  RestartInterviewResponse,
  StartNewGoalResponse,
} from '@questline/shared';
import type { GoalRepository } from '../repositories/goalRepository.js';
import { notFound, validationError } from './errors.js';

export type GoalServiceDeps = {
  goals: GoalRepository;
  /** Reuse Issue #3 restart so "＋ New goal" clears chat + interview. */
  restartInterview: (userId: number) => Promise<RestartInterviewResponse>;
};

export function createGoalService(deps: GoalServiceDeps) {
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
    let result;
    try {
      result = await deps.goals.deleteForUser(goalId, userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'GOAL_NOT_FOUND') {
        throw notFound('That goal was not found on your diary ♡');
      }
      throw err;
    }

    const listed = await listPayload(userId);
    return {
      deleted_goal_id: result.deleted.id,
      goals: listed.goals,
      active_goal_id: listed.active_goal_id,
    };
  }

  return {
    listGoals,
    activateGoal,
    startNewGoal,
    deleteGoal,
  };
}

export type GoalService = ReturnType<typeof createGoalService>;
