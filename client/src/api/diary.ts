import { DiaryNoteSchema, type DiaryNote } from '@questline/shared';
import { authHeaders } from './authToken';

export const FRIENDLY_DIARY_LOAD_ERROR =
  "Mochi couldn't open today's diary note right now. Take a gentle breath and try again in a moment.";

export const FRIENDLY_DIARY_SAVE_ERROR =
  "Mochi couldn't save your diary note just now — your words are still right here ♡";

async function parseJson(res: Response, fallbackError: string): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    console.error('Failed to parse diary note JSON:', err);
    throw new Error(fallbackError);
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error?: { message?: string } }).error?.message === 'string'
  ) {
    const raw = (body as { error: { message: string } }).error.message.trim();
    if (raw && !raw.startsWith('[') && !raw.startsWith('{')) {
      return raw;
    }
  }
  return fallback;
}

function parseDiaryNote(body: unknown, fallbackError: string): DiaryNote {
  const parsed = DiaryNoteSchema.safeParse(body);
  if (!parsed.success) {
    console.error('Invalid diary note payload:', parsed.error);
    throw new Error(fallbackError);
  }
  return parsed.data;
}

export async function fetchDiaryNote(localDate?: string): Promise<DiaryNote> {
  const qs = localDate ? `?local_date=${encodeURIComponent(localDate)}` : '';
  const res = await fetch(`/api/diary-notes${qs}`, {
    headers: authHeaders(),
  });
  const body = await parseJson(res, FRIENDLY_DIARY_LOAD_ERROR);
  if (!res.ok) {
    throw new Error(errorMessage(body, FRIENDLY_DIARY_LOAD_ERROR));
  }
  return parseDiaryNote(body, FRIENDLY_DIARY_LOAD_ERROR);
}

export async function saveDiaryNote(content: string, localDate?: string): Promise<DiaryNote> {
  const res = await fetch('/api/diary-notes', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      content,
      ...(localDate ? { local_date: localDate } : {}),
    }),
  });
  const body = await parseJson(res, FRIENDLY_DIARY_SAVE_ERROR);
  if (!res.ok) {
    throw new Error(errorMessage(body, FRIENDLY_DIARY_SAVE_ERROR));
  }
  return parseDiaryNote(body, FRIENDLY_DIARY_SAVE_ERROR);
}
