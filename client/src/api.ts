import type { Quest, QuestUpdateResponse, TodayQuestsResponse } from '@questline/shared';

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchTodayQuests(): Promise<TodayQuestsResponse> {
  const res = await fetch('/api/quests/today');
  return parseJson<TodayQuestsResponse>(res);
}

export async function completeQuest(id: string): Promise<Quest> {
  const res = await fetch(`/api/quests/${id}/complete`, { method: 'POST' });
  const data = await parseJson<QuestUpdateResponse>(res);
  return data.quest;
}

export async function uncompleteQuest(id: string): Promise<Quest> {
  const res = await fetch(`/api/quests/${id}/uncomplete`, { method: 'POST' });
  const data = await parseJson<QuestUpdateResponse>(res);
  return data.quest;
}
