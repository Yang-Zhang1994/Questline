import { RoadmapResponseSchema, type RoadmapResponse } from '@questline/shared';
import { authHeaders } from './authToken';

export const FRIENDLY_ROADMAP_ERROR =
  "Mochi couldn't unroll your map right now. Please try again in a moment.";

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    console.error('Failed to parse roadmap JSON:', err);
    throw new Error(FRIENDLY_ROADMAP_ERROR);
  }
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

export async function fetchRoadmap(): Promise<RoadmapResponse> {
  const res = await fetch('/api/roadmap', {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, FRIENDLY_ROADMAP_ERROR));
  }
  const parsed = RoadmapResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.error('Invalid roadmap response payload:', parsed.error);
    throw new Error(FRIENDLY_ROADMAP_ERROR);
  }
  return parsed.data;
}
