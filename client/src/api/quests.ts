import {
  TodayQuestsResponseSchema,
  ToggleQuestCompletionResponseSchema,
  type TodayQuestsResponse,
  type Quest,
} from '@questline/shared';

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

export async function fetchTodayQuests(localDate?: string): Promise<TodayQuestsResponse> {
  const params = new URLSearchParams();
  if (localDate) params.set('local_date', localDate);
  const qs = params.toString();
  const res = await fetch(`/api/quests/today${qs ? `?${qs}` : ''}`);
  const body = await parseJson(res);
  if (!res.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error?: { message?: string } }).error?.message === 'string'
        ? (body as { error: { message: string } }).error.message
        : "Could not load today's quests";
    throw new Error(message);
  }
  return TodayQuestsResponseSchema.parse(body);
}

export async function setQuestCompletion(questId: number, completed: boolean): Promise<Quest> {
  const res = await fetch(`/api/quests/${questId}/completion`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error?: { message?: string } }).error?.message === 'string'
        ? (body as { error: { message: string } }).error.message
        : 'Could not update quest';
    throw new Error(message);
  }
  return ToggleQuestCompletionResponseSchema.parse(body).quest;
}
