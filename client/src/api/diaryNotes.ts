import {
  DiaryNoteResponseSchema,
  type DiaryNoteResponse,
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

export async function fetchDiaryNote(localDate?: string): Promise<DiaryNoteResponse> {
  const params = new URLSearchParams();
  if (localDate) params.set('local_date', localDate);
  const query = params.toString();
  const res = await fetch(`/api/diary-notes${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not load your diary note'));
  }
  return DiaryNoteResponseSchema.parse(body);
}

export async function saveDiaryNote(
  content: string,
  localDate?: string,
): Promise<DiaryNoteResponse> {
  const res = await fetch('/api/diary-notes', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      content,
      ...(localDate ? { local_date: localDate } : {}),
    }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Could not save your diary note'));
  }
  return DiaryNoteResponseSchema.parse(body);
}
