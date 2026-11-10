import { z, type ZodType } from 'zod';

/**
 * Parse model JSON into a zod schema. Strips optional ```json fences.
 * Returns null on failure (caller may retry once per AGENTS.md).
 */
export function parseModelJson<T>(raw: string, schema: ZodType<T>): T | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed: unknown = JSON.parse(unfenced);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Count ASCII "?" marks — used to enforce one question per Mochi interview turn. */
export function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

export function ensureOneQuestion(text: string, fallbackQuestion: string): string {
  const count = countQuestions(text);
  if (count === 1) return text.trim();
  const withoutTrailing = text.trim().replace(/\?+/g, '.').replace(/\.\s*$/, '');
  if (!withoutTrailing) return fallbackQuestion;
  return `${withoutTrailing} ${fallbackQuestion}`.trim();
}

export function ensureNoQuestion(text: string): string {
  return text
    .trim()
    .replace(/\?/g, '.')
    .replace(/\.\s*\./g, '.')
    .trim();
}

/** Re-export zod helper for typed schemas living next to parse helpers. */
export { z };
