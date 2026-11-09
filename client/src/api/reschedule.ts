import {
  ConfirmRescheduleResponseSchema,
  RescheduleDraftSchema,
  RescheduleResponseSchema,
  type ConfirmRescheduleResponse,
  type RescheduleDraft,
  type RescheduleResponse,
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

export async function fetchReschedule(localDate?: string): Promise<RescheduleResponse> {
  const params = new URLSearchParams();
  if (localDate) params.set('local_date', localDate);
  const qs = params.toString();
  const res = await fetch(`/api/quests/reschedule${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not load reschedule preview'));
  }
  return RescheduleResponseSchema.parse(body);
}

export async function proposeReschedule(localDate?: string): Promise<RescheduleResponse> {
  const res = await fetch('/api/quests/reschedule', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(localDate ? { local_date: localDate } : {}),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not draft a reschedule'));
  }
  return RescheduleResponseSchema.parse(body);
}

export async function reviseReschedule(
  feedback?: string,
  localDate?: string,
): Promise<RescheduleResponse> {
  const res = await fetch('/api/quests/reschedule/revise', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      ...(feedback?.trim() ? { feedback: feedback.trim() } : {}),
      ...(localDate ? { local_date: localDate } : {}),
    }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not revise the reschedule'));
  }
  return RescheduleResponseSchema.parse(body);
}

export async function confirmReschedule(
  draft: RescheduleDraft,
  localDate?: string,
): Promise<ConfirmRescheduleResponse> {
  const checked = RescheduleDraftSchema.parse(draft);
  const res = await fetch('/api/quests/reschedule/confirm', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      draft: checked,
      ...(localDate ? { local_date: localDate } : {}),
    }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not save the reschedule'));
  }
  return ConfirmRescheduleResponseSchema.parse(body);
}
