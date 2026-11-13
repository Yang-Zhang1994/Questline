import {
  CurrentMilestoneQuestsResponseSchema,
  type CurrentMilestoneQuestsResponse,
} from '@questline/shared';
import { authHeaders } from './authToken';

export const FRIENDLY_QUESTS_ERROR =
  "Mochi couldn't open today's quest note right now. Take a gentle breath and try again in a moment.";

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

export async function fetchCurrentMilestoneQuests(): Promise<CurrentMilestoneQuestsResponse> {
  const res = await fetch('/api/quests', {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, FRIENDLY_QUESTS_ERROR));
  }
  return parseQuestsResponse(body);
}

export async function generateCurrentMilestoneQuests(): Promise<CurrentMilestoneQuestsResponse> {
  const res = await fetch('/api/quests/generate', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, FRIENDLY_QUESTS_ERROR));
  }
  return parseQuestsResponse(body);
}
