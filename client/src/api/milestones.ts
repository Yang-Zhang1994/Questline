import {
  CompleteStageResponseSchema,
  ConfirmMilestonePlanResponseSchema,
  MilestonePlanDraftSchema,
  MilestonePlanResponseSchema,
  type CompleteStageResponse,
  type ConfirmMilestonePlanResponse,
  type MilestonePlanDraft,
  type MilestonePlanResponse,
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

export async function fetchMilestonePlan(): Promise<MilestonePlanResponse> {
  const res = await fetch('/api/milestones/draft', {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not load milestone plan'));
  }
  return MilestonePlanResponseSchema.parse(body);
}

export async function proposeMilestonePlan(): Promise<MilestonePlanResponse> {
  const res = await fetch('/api/milestones/draft', {
    method: 'POST',
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not draft a milestone plan'));
  }
  return MilestonePlanResponseSchema.parse(body);
}

export async function reviseMilestonePlan(feedback?: string): Promise<MilestonePlanResponse> {
  const res = await fetch('/api/milestones/draft/revise', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(feedback?.trim() ? { feedback: feedback.trim() } : {}),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not revise the milestone plan'));
  }
  return MilestonePlanResponseSchema.parse(body);
}

export async function confirmMilestonePlan(
  draft: MilestonePlanDraft,
): Promise<ConfirmMilestonePlanResponse> {
  // Client-side guard: only send a schema-valid draft on confirm.
  const checked = MilestonePlanDraftSchema.parse(draft);
  const res = await fetch('/api/milestones/confirm', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ draft: checked }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not save the milestone plan'));
  }
  return ConfirmMilestonePlanResponseSchema.parse(body);
}

/** Confirm stage clear — advances roadmap highlight (#10). */
export async function completeStage(milestoneId: number): Promise<CompleteStageResponse> {
  const res = await fetch(`/api/milestones/${milestoneId}/complete`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not mark this stage complete'));
  }
  return CompleteStageResponseSchema.parse(body);
}
