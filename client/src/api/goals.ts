import {
  ActivateGoalResponseSchema,
  DeleteGoalResponseSchema,
  GoalsListResponseSchema,
  StartNewGoalResponseSchema,
  type ActivateGoalResponse,
  type DeleteGoalResponse,
  type GoalsListResponse,
  type StartNewGoalResponse,
} from '@questline/shared';
import { authHeaders } from './authToken';

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

function errorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error?: { message?: string } }).error?.message === 'string'
  ) {
    return (body as { error: { message: string } }).error.message;
  }
  return fallback;
}

export async function fetchGoals(): Promise<GoalsListResponse> {
  const res = await fetch('/api/goals', {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not load your goals'));
  }
  return GoalsListResponseSchema.parse(body);
}

export async function activateGoal(goalId: number): Promise<ActivateGoalResponse> {
  const res = await fetch(`/api/goals/${goalId}/activate`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not switch goals'));
  }
  return ActivateGoalResponseSchema.parse(body);
}

export async function startNewGoal(): Promise<StartNewGoalResponse> {
  const res = await fetch('/api/goals/new', {
    method: 'POST',
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not start a new goal'));
  }
  return StartNewGoalResponseSchema.parse(body);
}

export async function deleteGoal(goalId: number): Promise<DeleteGoalResponse> {
  const res = await fetch(`/api/goals/${goalId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not delete that goal'));
  }
  return DeleteGoalResponseSchema.parse(body);
}
