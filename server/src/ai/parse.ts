import { z, type ZodType } from 'zod';
import { DEFAULT_TIME_BUDGET_MINUTES } from '../config/game.js';

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

/** Normalized interview time-budget answer (stored as free text; minutes for downstream). */
export type ParsedTimeBudget = {
  display: string;
  minutesPerDay: number;
  skipped: boolean;
};

const SKIP_TIME_ANSWERS = new Set([
  'skip',
  'skipped',
  'pass',
  'none',
  'n/a',
  'na',
  'default',
  'idk skip',
]);

function formatMinutesPerDay(minutes: number): string {
  // Prefer hours only for clean half-hour budgets (60, 90, 120…); keep 100 as minutes.
  if (minutes >= 60 && minutes % 30 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour a day' : `${hours} hours a day`;
  }
  return minutes === 1 ? '1 minute a day' : `${minutes} minutes a day`;
}

function formatHoursPerWeek(hours: number): string {
  return hours === 1 ? '1 hour a week' : `${hours} hours a week`;
}

/**
 * Accept natural time-budget interview answers so compact forms like
 * `10h/week`, `1.5h/day`, `100`, or `skip` advance the topic instead of looping.
 * Returns null when the answer is not a recognizable time budget.
 */
export function parseTimeBudgetAnswer(raw: string): ParsedTimeBudget | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase().replace(/,/g, '');
  if (SKIP_TIME_ANSWERS.has(lower)) {
    return {
      display: `about ${DEFAULT_TIME_BUDGET_MINUTES} minutes a day (soft default)`,
      minutesPerDay: DEFAULT_TIME_BUDGET_MINUTES,
      skipped: true,
    };
  }

  // 10h/week | 10 hours/week | 10 hrs a week | 10h per week
  const weekHours = lower.match(
    /^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)?(?:\s*(?:\/|per|a|each)\s*weeks?|\s*\/\s*w)$/,
  );
  if (weekHours) {
    const hours = Number(weekHours[1]);
    if (Number.isFinite(hours) && hours > 0 && hours <= 168) {
      const minutesPerDay = Math.max(1, Math.round((hours * 60) / 7));
      return {
        display: formatHoursPerWeek(hours),
        minutesPerDay,
        skipped: false,
      };
    }
  }

  // 90m/week | 90 min a week
  const weekMinutes = lower.match(
    /^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes?)(?:\s*(?:\/|per|a|each)\s*weeks?)$/,
  );
  if (weekMinutes) {
    const mins = Number(weekMinutes[1]);
    if (Number.isFinite(mins) && mins > 0) {
      const minutesPerDay = Math.max(1, Math.round(mins / 7));
      return {
        display: `${Math.round(mins)} minutes a week`,
        minutesPerDay,
        skipped: false,
      };
    }
  }

  // 1.5h/day | 1.5 hours a day | 1.5h per day
  const dayHours = lower.match(
    /^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)(?:\s*(?:\/|per|a|each)\s*days?)?$/,
  );
  if (dayHours) {
    const hours = Number(dayHours[1]);
    if (Number.isFinite(hours) && hours > 0 && hours <= 24) {
      const minutesPerDay = Math.max(1, Math.round(hours * 60));
      return {
        display: formatMinutesPerDay(minutesPerDay),
        minutesPerDay,
        skipped: false,
      };
    }
  }

  // 1.5/day — bare number with /day (treat as hours when fractional or ≤ 12)
  const barePerDay = lower.match(/^(\d+(?:\.\d+)?)\s*(?:\/|per|a|each)\s*days?$/);
  if (barePerDay) {
    const n = Number(barePerDay[1]);
    if (Number.isFinite(n) && n > 0) {
      const asHours = !Number.isInteger(n) || n <= 12;
      const minutesPerDay = asHours
        ? Math.max(1, Math.round(n * 60))
        : Math.max(1, Math.round(n));
      return {
        display: formatMinutesPerDay(minutesPerDay),
        minutesPerDay,
        skipped: false,
      };
    }
  }

  // 20m/day | 20 min a day | 20 minutes/day
  const dayMinutes = lower.match(
    /^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes?)(?:\s*(?:\/|per|a|each)\s*days?)?$/,
  );
  if (dayMinutes) {
    const mins = Math.round(Number(dayMinutes[1]));
    if (Number.isFinite(mins) && mins > 0 && mins <= 24 * 60) {
      return {
        display: formatMinutesPerDay(mins),
        minutesPerDay: mins,
        skipped: false,
      };
    }
  }

  // Free-text prose: "20 minutes a day", "about 2 hours most evenings"
  const proseHours = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  const proseWeek = /\b(week|weekly)\b/.test(lower);
  if (proseHours) {
    const hours = Number(proseHours[1]);
    if (Number.isFinite(hours) && hours > 0) {
      const minutesPerDay = proseWeek
        ? Math.max(1, Math.round((hours * 60) / 7))
        : Math.max(1, Math.round(hours * 60));
      return {
        display: proseWeek ? formatHoursPerWeek(hours) : formatMinutesPerDay(minutesPerDay),
        minutesPerDay,
        skipped: false,
      };
    }
  }

  const proseMins = lower.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
  if (proseMins) {
    const mins = Number(proseMins[1]);
    if (Number.isFinite(mins) && mins > 0) {
      const minutesPerDay = proseWeek ? Math.max(1, Math.round(mins / 7)) : mins;
      return {
        display: proseWeek ? `${mins} minutes a week` : formatMinutesPerDay(mins),
        minutesPerDay,
        skipped: false,
      };
    }
  }

  // Bare number → minutes per day (e.g. "100")
  if (/^\d+$/.test(lower)) {
    const mins = Number(lower);
    if (mins > 0 && mins <= 24 * 60) {
      return {
        display: formatMinutesPerDay(mins),
        minutesPerDay: mins,
        skipped: false,
      };
    }
  }

  return null;
}

/**
 * Daily minutes heuristic for GoalConfirm / planning (nullish → soft default).
 * Prefer {@link parseTimeBudgetAnswer} when you need accept/reject semantics.
 */
export function parseTimeBudgetMinutes(raw: string | null | undefined): number {
  if (!raw) return DEFAULT_TIME_BUDGET_MINUTES;
  return parseTimeBudgetAnswer(raw)?.minutesPerDay ?? DEFAULT_TIME_BUDGET_MINUTES;
}
