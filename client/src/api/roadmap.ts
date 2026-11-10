import { RoadmapResponseSchema, type RoadmapResponse } from '@questline/shared';

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

export async function fetchRoadmap(): Promise<RoadmapResponse> {
  const res = await fetch('/api/roadmap');
  const body = await parseJson(res);
  if (!res.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error?: { message?: string } }).error?.message === 'string'
        ? (body as { error: { message: string } }).error.message
        : 'Could not load roadmap';
    throw new Error(message);
  }
  return RoadmapResponseSchema.parse(body);
}
