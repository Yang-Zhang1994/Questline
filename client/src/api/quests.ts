import {
  ConfirmWeekPlanResponseSchema,
  CurrentMilestoneQuestsResponseSchema,
  ProposeWeekPlanResponseSchema,
  ToggleQuestCompletionResponseSchema,
  type ConfirmWeekPlanBody,
  type ConfirmWeekPlanResponse,
  type CurrentMilestoneQuestsResponse,
  type ProposeWeekPlanBody,
  type ProposeWeekPlanResponse,
  type ToggleQuestCompletionResponse,
} from '@questline/shared';
import { ApiError, errorCode } from './apiError';
import { authHeaders } from './authToken';

export const FRIENDLY_QUESTS_ERROR =
  "Mochi couldn't open today's quest note right now. Take a gentle breath and try again in a moment.";

export const FRIENDLY_QUEST_TOGGLE_ERROR =
  "Mochi couldn't save that check-off just now — your quest was put right back so you can try again ♡";

export const FRIENDLY_WEEK_PLAN_ERROR =
  "Mochi couldn't sketch your weekly quest plan right now. Take a gentle breath and try again in a moment ♡";

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    console.error('Failed to parse quests JSON:', err);
    throw new Error(FRIENDLY_QUESTS_ERROR);
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error?: { message?: string } }).error?.message === 'string'
  ) {
    const raw = (body as { error: { message: string } }).error.message.trim();
    if (raw && !raw.startsWith('[') && !raw.startsWith('{')) {
      return raw;
    }
  }
  return fallback;
}

function parseQuestsResponse(body: unknown): CurrentMilestoneQuestsResponse {
  const parsed = CurrentMilestoneQuestsResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.error('Invalid quests response payload:', parsed.error);
    throw new Error(FRIENDLY_QUESTS_ERROR);
  }
  return parsed.data;
}

export async function fetchCurrentMilestoneQuests(
  localDate?: string,
): Promise<CurrentMilestoneQuestsResponse> {
  const qs = localDate ? `?local_date=${encodeURIComponent(localDate)}` : '';
  const res = await fetch(`/api/quests${qs}`, {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, FRIENDLY_QUESTS_ERROR));
  }
  return parseQuestsResponse(body);
}

export async function generateCurrentMilestoneQuests(
  localDate?: string,
): Promise<CurrentMilestoneQuestsResponse> {
  const res = await fetch('/api/quests/generate', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(localDate ? { local_date: localDate } : {}),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, FRIENDLY_QUESTS_ERROR));
  }
  return parseQuestsResponse(body);
}

export async function toggleQuestCompletion(
  questId: number,
  completed: boolean,
  localDate?: string,
): Promise<ToggleQuestCompletionResponse> {
  const res = await fetch(`/api/quests/${questId}/completion`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      completed,
      ...(localDate ? { local_date: localDate } : {}),
    }),
  });
  let body: unknown;
  try {
    body = await parseJson(res);
  } catch {
    throw new Error(FRIENDLY_QUEST_TOGGLE_ERROR);
  }
  if (!res.ok) {
    throw new Error(errorMessage(body, FRIENDLY_QUEST_TOGGLE_ERROR));
  }
  const parsed = ToggleQuestCompletionResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.error('Invalid toggle quest response payload:', parsed.error);
    throw new Error(FRIENDLY_QUEST_TOGGLE_ERROR);
  }
  return parsed.data;
}

export async function proposeWeekPlan(
  options: ProposeWeekPlanBody = {},
): Promise<ProposeWeekPlanResponse> {
  const res = await fetch('/api/quests/week-plan/propose', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(options),
  });
  let body: unknown;
  try {
    body = await parseJson(res);
  } catch {
    throw new Error(FRIENDLY_WEEK_PLAN_ERROR);
  }
  if (!res.ok) {
    throw new ApiError(
      errorMessage(body, FRIENDLY_WEEK_PLAN_ERROR),
      errorCode(body),
      res.status,
    );
  }
  const parsed = ProposeWeekPlanResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.error('Invalid proposeWeekPlan response payload:', parsed.error);
    throw new Error(FRIENDLY_WEEK_PLAN_ERROR);
  }
  return parsed.data;
}

export async function confirmWeekPlan(
  options: ConfirmWeekPlanBody,
): Promise<ConfirmWeekPlanResponse> {
  const res = await fetch('/api/quests/week-plan/confirm', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(options),
  });
  let body: unknown;
  try {
    body = await parseJson(res);
  } catch {
    throw new Error(FRIENDLY_WEEK_PLAN_ERROR);
  }
  if (!res.ok) {
    throw new ApiError(
      errorMessage(body, FRIENDLY_WEEK_PLAN_ERROR),
      errorCode(body),
      res.status,
    );
  }
  const parsed = ConfirmWeekPlanResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.error('Invalid confirmWeekPlan response payload:', parsed.error);
    throw new Error(FRIENDLY_WEEK_PLAN_ERROR);
  }
  return parsed.data;
}
