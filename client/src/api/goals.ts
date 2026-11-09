import {
  ConfirmGoalResponseSchema,
  GoalDraftResponseSchema,
  InterviewStateSchema,
  type ConfirmGoalResponse,
  type GoalDraft,
  type GoalDraftResponse,
  type InterviewState,
} from '@questline/shared';
import { z } from 'zod';
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

export async function fetchGoalDraft(): Promise<GoalDraftResponse> {
  const res = await fetch('/api/goals/draft', {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not load goal draft'));
  }
  return GoalDraftResponseSchema.parse(body);
}

export async function proposeGoalDraft(): Promise<GoalDraftResponse> {
  const res = await fetch('/api/goals/draft', {
    method: 'POST',
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not draft a goal'));
  }
  return GoalDraftResponseSchema.parse(body);
}

export async function reviseGoalDraft(feedback?: string): Promise<GoalDraftResponse> {
  const res = await fetch('/api/goals/draft/revise', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(feedback?.trim() ? { feedback: feedback.trim() } : {}),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not revise the goal'));
  }
  return GoalDraftResponseSchema.parse(body);
}

const ReturnToInterviewResponseSchema = z.object({
  interview: InterviewStateSchema,
});

export async function returnGoalDraftToInterview(): Promise<{ interview: InterviewState }> {
  const res = await fetch('/api/goals/draft/return-to-interview', {
    method: 'POST',
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not return to the interview'));
  }
  return ReturnToInterviewResponseSchema.parse(body);
}

export async function confirmGoalDraft(draft: GoalDraft): Promise<ConfirmGoalResponse> {
  const res = await fetch('/api/goals/confirm', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ draft }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not save the goal'));
  }
  return ConfirmGoalResponseSchema.parse(body);
}
