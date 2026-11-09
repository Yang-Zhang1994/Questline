import {
  ConfirmWeekPlanResponseSchema,
  WeekPlanDraftSchema,
  WeekPlanResponseSchema,
  type ConfirmWeekPlanResponse,
  type WeekPlanDraft,
  type WeekPlanResponse,
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

export async function fetchWeekPlan(localDate?: string): Promise<WeekPlanResponse> {
  const params = new URLSearchParams();
  if (localDate) params.set('local_date', localDate);
  const qs = params.toString();
  const res = await fetch(`/api/quests/week-plan${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not load week plan preview'));
  }
  return WeekPlanResponseSchema.parse(body);
}

export async function proposeWeekPlan(localDate?: string): Promise<WeekPlanResponse> {
  const res = await fetch('/api/quests/week-plan', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(localDate ? { local_date: localDate } : {}),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not draft a week plan'));
  }
  return WeekPlanResponseSchema.parse(body);
}

export async function reviseWeekPlan(
  feedback?: string,
  localDate?: string,
): Promise<WeekPlanResponse> {
  const res = await fetch('/api/quests/week-plan/revise', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      ...(feedback?.trim() ? { feedback: feedback.trim() } : {}),
      ...(localDate ? { local_date: localDate } : {}),
    }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not revise the week plan'));
  }
  return WeekPlanResponseSchema.parse(body);
}

export async function confirmWeekPlan(
  draft: WeekPlanDraft,
  localDate?: string,
): Promise<ConfirmWeekPlanResponse> {
  const checked = WeekPlanDraftSchema.parse(draft);
  const res = await fetch('/api/quests/week-plan/confirm', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      draft: checked,
      ...(localDate ? { local_date: localDate } : {}),
    }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not save the week plan'));
  }
  return ConfirmWeekPlanResponseSchema.parse(body);
}
