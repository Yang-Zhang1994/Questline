import {
  ConfirmMilestonesResponseSchema,
  MilestonePlanStateResponseSchema,
  ProposeMilestonesResponseSchema,
  type ConfirmMilestonesResponse,
  type Milestone,
  type MilestonePlanStateResponse,
  type ProposeMilestonesBody,
  type ProposeMilestonesResponse,
  type ProposedMilestone,
  type RoadmapGoal,
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

export async function fetchMilestonePlanState(): Promise<MilestonePlanStateResponse> {
  const res = await fetch('/api/milestones', {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not load milestone plan'));
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
    throw new Error(errorMessage(body, 'Could not propose milestones'));
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
    throw new Error(errorMessage(body, 'Could not confirm milestones'));
  }
  return ConfirmMilestonesResponseSchema.parse(body);
}

export type { Milestone, ProposedMilestone, RoadmapGoal };
