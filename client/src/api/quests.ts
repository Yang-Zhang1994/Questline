import {
  CreateQuestResponseSchema,
  DeleteQuestResponseSchema,
  MilestoneQuestsResponseSchema,
  TodayQuestsResponseSchema,
  ToggleQuestCompletionResponseSchema,
  type CreateQuestResponse,
  type DeleteQuestResponse,
  type MilestoneQuestsResponse,
  type TodayQuestsResponse,
  type ToggleQuestCompletionResponse,
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

export async function fetchTodayQuests(localDate?: string): Promise<TodayQuestsResponse> {
  const params = new URLSearchParams();
  if (localDate) params.set('local_date', localDate);
  const qs = params.toString();
  const res = await fetch(`/api/quests/today${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, "Could not load today's quests"));
  }
  return TodayQuestsResponseSchema.parse(body);
}

export async function setQuestCompletion(
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
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not update quest'));
  }
  return ToggleQuestCompletionResponseSchema.parse(body);
}

/** Load quests for a milestone sheet (Issue #20). */
export async function fetchMilestoneQuests(milestoneId: number): Promise<MilestoneQuestsResponse> {
  const res = await fetch(`/api/quests?milestone_id=${milestoneId}`, {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not load milestone quests'));
  }
  return MilestoneQuestsResponseSchema.parse(body);
}

/** Manual Add on the Map sheet (Issue #20). */
export async function createQuest(input: {
  milestoneId: number;
  title: string;
  dueDate: string;
  estimatedMinutes?: number | null;
}): Promise<CreateQuestResponse> {
  const res = await fetch('/api/quests', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      milestone_id: input.milestoneId,
      title: input.title,
      due_date: input.dueDate,
      ...(input.estimatedMinutes !== undefined
        ? { estimated_minutes: input.estimatedMinutes }
        : {}),
    }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not add quest'));
  }
  return CreateQuestResponseSchema.parse(body);
}

/** Delete from the Map sheet; reverses XP when the quest was completed (Issue #20). */
export async function deleteQuest(
  questId: number,
  localDate?: string,
): Promise<DeleteQuestResponse> {
  const res = await fetch(`/api/quests/${questId}`, {
    method: 'DELETE',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(localDate ? { local_date: localDate } : {}),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not delete quest'));
  }
  return DeleteQuestResponseSchema.parse(body);
}
