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
