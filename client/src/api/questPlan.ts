import {
  ConfirmQuestPlanResponseSchema,
  QuestPlanDraftSchema,
  QuestPlanResponseSchema,
  type ConfirmQuestPlanResponse,
  type QuestPlanDraft,
  type QuestPlanResponse,
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

export async function fetchQuestPlan(): Promise<QuestPlanResponse> {
  const res = await fetch('/api/quests/draft', {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not load quest plan'));
  }
  return QuestPlanResponseSchema.parse(body);
}

export async function proposeQuestPlan(): Promise<QuestPlanResponse> {
  const res = await fetch('/api/quests/draft', {
    method: 'POST',
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not draft a quest plan'));
  }
  return QuestPlanResponseSchema.parse(body);
}

export async function reviseQuestPlan(feedback?: string): Promise<QuestPlanResponse> {
  const res = await fetch('/api/quests/draft/revise', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(feedback?.trim() ? { feedback: feedback.trim() } : {}),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not revise the quest plan'));
  }
  return QuestPlanResponseSchema.parse(body);
}

export async function confirmQuestPlan(
  draft: QuestPlanDraft,
): Promise<ConfirmQuestPlanResponse> {
  const checked = QuestPlanDraftSchema.parse(draft);
  const res = await fetch('/api/quests/confirm', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ draft: checked }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not save the quest plan'));
  }
  return ConfirmQuestPlanResponseSchema.parse(body);
}
