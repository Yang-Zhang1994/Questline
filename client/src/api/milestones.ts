import {
  CompleteStageResponseSchema,
  ConfirmMilestonesResponseSchema,
  MilestonePlanStateResponseSchema,
  ProposeMilestonesResponseSchema,
  type CompleteStageResponse,
  type ConfirmMilestonesResponse,
  type Milestone,
  type MilestonePlanStateResponse,
  type ProposeMilestonesBody,
  type ProposeMilestonesResponse,
  type ProposedMilestone,
  type RoadmapGoal,
} from '@questline/shared';
import { throwApiError } from './apiError';
import { authHeaders } from './authToken';

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

export async function fetchMilestonePlanState(): Promise<MilestonePlanStateResponse> {
  const res = await fetch('/api/milestones', {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throwApiError(res, body, 'Could not load milestone plan');
  }
  return MilestonePlanStateResponseSchema.parse(body);
}

export async function proposeMilestones(
  options: ProposeMilestonesBody = {},
): Promise<ProposeMilestonesResponse> {
  const res = await fetch('/api/milestones/propose', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(options),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throwApiError(res, body, 'Could not propose milestones');
  }
  return ProposeMilestonesResponseSchema.parse(body);
}

export async function confirmMilestones(
  milestones: ProposedMilestone[],
): Promise<ConfirmMilestonesResponse> {
  const res = await fetch('/api/milestones/confirm', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ milestones }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throwApiError(res, body, 'Could not confirm milestones');
  }
  return ConfirmMilestonesResponseSchema.parse(body);
}

/** Confirm stage clear — advances roadmap highlight (#10). */
export async function completeStage(milestoneId: number): Promise<CompleteStageResponse> {
  const res = await fetch(`/api/milestones/${milestoneId}/complete`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throwApiError(res, body, 'Could not mark this stage complete');
  }
  return CompleteStageResponseSchema.parse(body);
}

export type { Milestone, ProposedMilestone, RoadmapGoal };
