import { isLocalDateWithinOneDay, isRealCalendarDate } from '@questline/shared';
import { validationError } from './services/errors.js';

/** Injectable clock — never use bare `new Date()` for "today" / streaks. */
export type Clock = {
  now: () => Date;
};

export const systemClock: Clock = {
  now: () => new Date(),
};

/** Format a Date as local YYYY-MM-DD (uses the Date's local calendar fields). */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toIsoDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Resolves and validates a client-supplied `local_date` against the server clock:
 * - Defaults to `formatLocalDate(clock.now())` when omitted.
 * - Rejects non-existent calendar dates (e.g. `2026-02-30`).
 * - Rejects dates more than ±1 calendar day from the server's current date.
 */
export function resolveClientLocalDate(
  localDate: string | undefined,
  clock: Clock,
): string {
  const serverDate = formatLocalDate(clock.now());
  if (localDate === undefined) {
    return serverDate;
  }
  if (!isRealCalendarDate(localDate)) {
    throw validationError(
      `Invalid local_date "${localDate}": expected a real YYYY-MM-DD calendar date.`,
    );
  }
  if (!isLocalDateWithinOneDay(localDate, serverDate)) {
    throw validationError(
      `Invalid local_date "${localDate}": must be within 1 day of server date (${serverDate}).`,
    );
  }
  return localDate;
}
