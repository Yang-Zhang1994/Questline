/** Game tuning knobs — XP / levels (#11) and daily streaks (#12). */

/** XP awarded when a quest is completed (reversed on undo). */
export const XP_PER_QUEST = 10;

/**
 * Cumulative XP required to *reach* each level (1-indexed).
 * Index 0 is unused; level 1 starts at 0 XP.
 * Crossing `XP_TO_REACH_LEVEL[n]` means the user is at least level `n`.
 */
export const XP_TO_REACH_LEVEL = [
  0, // unused
  0, // level 1
  50, // level 2 — 5 quests
  120, // level 3
  210, // level 4
  320, // level 5
  450, // level 6
  600, // level 7
  780, // level 8
  1000, // level 9
  1250, // level 10
] as const;

/** Extra cumulative XP per level beyond the last defined threshold. */
export const XP_PER_LEVEL_BEYOND = 300;

/** Fallback daily minutes when a goal has no time_budget_minutes_per_day. */
export const DEFAULT_TIME_BUDGET_MINUTES = 30;

/** Soft upper bound for one sitting — keeps AI quests small (#7). */
export const MAX_QUEST_MINUTES = 45;

/** Fixed number of stamp slots on each stamp card (#13). */
export const STAMPS_PER_CARD = 10;

/** Cumulative XP required to reach `level` (level ≤ 1 → 0). */
export function xpToReachLevel(level: number): number {
  if (level <= 1) return 0;
  const lastDefined = XP_TO_REACH_LEVEL.length - 1;
  if (level <= lastDefined) {
    return XP_TO_REACH_LEVEL[level]!;
  }
  const lastXp = XP_TO_REACH_LEVEL[lastDefined]!;
  return lastXp + (level - lastDefined) * XP_PER_LEVEL_BEYOND;
}

/** Highest level whose threshold is ≤ total XP. */
export function levelFromTotalXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xpToReachLevel(level + 1) <= xp) {
    level += 1;
    if (level > 10_000) break;
  }
  return level;
}

export type ProgressSnapshot = {
  xp: number;
  level: number;
  /** XP earned within the current level (toward the next). */
  xp_into_level: number;
  /** XP span from current level floor → next level threshold. */
  xp_for_next_level: number;
  current_streak: number;
  best_streak: number;
  last_active_date: string | null;
};

export type StreakState = {
  current_streak: number;
  best_streak: number;
  last_active_date: string | null;
};

/** Previous calendar day for a YYYY-MM-DD string (UTC arithmetic — date-only). */
export function previousIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(year!, month! - 1, day!));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * First quest completion on `localDate` bumps the streak.
 * Same-day repeats are no-ops. A gap larger than yesterday starts a fresh streak at 1.
 */
export function applyActiveDay(state: StreakState, localDate: string): StreakState {
  if (state.last_active_date === localDate) {
    return state;
  }
  const current =
    state.last_active_date === previousIsoDate(localDate) ? state.current_streak + 1 : 1;
  return {
    current_streak: current,
    best_streak: Math.max(state.best_streak, current),
    last_active_date: localDate,
  };
}

/**
 * Undo the streak side effects of the last remaining completion on `localDate`.
 * Caller must only invoke when no other completions remain that day.
 */
export function revertActiveDay(state: StreakState, localDate: string): StreakState {
  if (state.last_active_date !== localDate) {
    return state;
  }
  const nextCurrent = Math.max(0, state.current_streak - 1);
  const nextBest =
    state.best_streak === state.current_streak ? nextCurrent : state.best_streak;
  return {
    current_streak: nextCurrent,
    best_streak: nextBest,
    last_active_date: nextCurrent === 0 ? null : previousIsoDate(localDate),
  };
}

/**
 * After a full missed local day, current streak reads as 0 (best is kept).
 * Alive if last active was today or yesterday relative to `localDate`.
 */
export function applyMissedDayReset(state: StreakState, localDate: string): StreakState {
  if (!state.last_active_date) {
    return { ...state, current_streak: 0 };
  }
  if (
    state.last_active_date === localDate ||
    state.last_active_date === previousIsoDate(localDate)
  ) {
    return state;
  }
  if (state.current_streak === 0) {
    return state;
  }
  return { ...state, current_streak: 0 };
}

export function progressSnapshotFromXp(
  totalXp: number,
  streak: StreakState = { current_streak: 0, best_streak: 0, last_active_date: null },
): ProgressSnapshot {
  const xp = Math.max(0, Math.floor(totalXp));
  const level = levelFromTotalXp(xp);
  const floor = xpToReachLevel(level);
  const next = xpToReachLevel(level + 1);
  const span = Math.max(1, next - floor);
  return {
    xp,
    level,
    xp_into_level: xp - floor,
    xp_for_next_level: span,
    current_streak: streak.current_streak,
    best_streak: streak.best_streak,
    last_active_date: streak.last_active_date,
  };
}

/** Short Mochi celebration when the user levels up. */
export function levelUpMessage(level: number): string {
  return `★ Level ${level}! Mochi is hopping with joy — you're growing so gently. ♡`;
}

/** Encouraging Mochi copy when a stage clears (#10) — never guilt. */
export function stageClearedMessage(stageTitle: string, nextTitle: string | null): string {
  if (nextTitle) {
    return `★ Stage cleared: “${stageTitle}”! Soft paws of applause — next up is “${nextTitle}”. Take it gentle. ♡`;
  }
  return `★ Stage cleared: “${stageTitle}”! Soft paws of applause — that was the last stage on this map. ♡`;
}

/** Celebration when the final milestone finishes the goal (#10). */
export function goalCompletedMessage(goalTitle: string): string {
  return `★ You did it! “${goalTitle}” is complete. Mochi is so proud of this gentle journey — celebrate softly. ♡`;
}

export type StampRowInput = {
  card_number: number;
  stamp_date: string;
};

export type StampPastCardSnapshot = {
  card_number: number;
  stamp_dates: string[];
  stamp_count: number;
};

export type StampCardSnapshot = {
  card_number: number;
  stamps_per_card: number;
  stamped_dates: string[];
  filled_count: number;
  past_cards: StampPastCardSnapshot[];
};

/** Warm Mochi celebration when a stamp card fills all slots (#13). */
export function cardCompletedMessage(cardNumber: number): string {
  return `★ Stamp Card #${cardNumber} is full! Mochi tucked it into your collection and opened a fresh card for you. ♡`;
}

/**
 * Builds the active stamp card + past cards history from a user's saved stamp rows (#13).
 *
 * - When the user has no stamps yet, Card #1 is active with 0 stamps.
 * - When the highest `card_number` has `STAMPS_PER_CARD` stamps (and no newer card has stamps yet),
 *   that full card is archived in `past_cards` and `highestCardNumber + 1` is shown as the fresh active card.
 * - If an undo removes the 10th stamp from that card, it drops to 9 stamps and seamlessly becomes
 *   the active card again.
 */
export function buildStampCardSnapshot(
  rows: readonly StampRowInput[],
  stampsPerCard: number = STAMPS_PER_CARD,
): StampCardSnapshot {
  if (rows.length === 0) {
    return {
      card_number: 1,
      stamps_per_card: stampsPerCard,
      stamped_dates: [],
      filled_count: 0,
      past_cards: [],
    };
  }

  const byCard = new Map<number, string[]>();
  let maxCardNumber = 1;
  for (const row of rows) {
    if (row.card_number > maxCardNumber) {
      maxCardNumber = row.card_number;
    }
    const dates = byCard.get(row.card_number) ?? [];
    dates.push(row.stamp_date);
    byCard.set(row.card_number, dates);
  }

  for (const dates of byCard.values()) {
    dates.sort();
  }

  const highestDates = byCard.get(maxCardNumber) ?? [];
  const highestIsFull = highestDates.length >= stampsPerCard;

  const activeCardNumber = highestIsFull ? maxCardNumber + 1 : maxCardNumber;
  const activeDates = highestIsFull ? [] : highestDates;

  const pastCards: StampPastCardSnapshot[] = [];
  const cardNumbers = [...byCard.keys()].sort((a, b) => a - b);
  for (const cardNum of cardNumbers) {
    if (cardNum === activeCardNumber) continue;
    const dates = byCard.get(cardNum) ?? [];
    pastCards.push({
      card_number: cardNum,
      stamp_dates: dates,
      stamp_count: dates.length,
    });
  }

  return {
    card_number: activeCardNumber,
    stamps_per_card: stampsPerCard,
    stamped_dates: activeDates,
    filled_count: activeDates.length,
    past_cards: pastCards,
  };
}

