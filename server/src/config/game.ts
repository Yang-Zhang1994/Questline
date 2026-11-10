/** Game tuning knobs — XP / levels (#11), daily streaks (#12), stamp cards (#13). */

/** XP awarded when a quest is completed (reversed on undo). */
export const XP_PER_QUEST = 10;

/** Fixed slots on one stamp card (not a 28-day calendar grid) — Issue #13. */
export const STAMPS_PER_CARD = 7;

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

/** Fallback daily minutes when a goal has no time_budget_minutes_per_day (#7). */
export const DEFAULT_TIME_BUDGET_MINUTES = 30;

/** Soft upper bound for one sitting — keeps AI quests small (#7). */
export const MAX_QUEST_MINUTES = 45;

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

/** Short Mochi celebration when a stamp card fills (#13). */
export function stampCardRewardMessage(cardNumber: number): string {
  return `★ Stamp card ${cardNumber} complete! Mochi pressed a soft little star on it — a fresh card is waiting for you. ♡`;
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

export type StampRow = {
  card_number: number;
  stamp_date: string;
};

export type StampCardSnapshot = {
  card_number: number;
  stamps_per_card: number;
  stamped_dates: string[];
  filled_count: number;
  past_cards: Array<{
    card_number: number;
    stamp_dates: string[];
    stamp_count: number;
  }>;
};

/**
 * Derive the current card + past history from persisted stamp rows.
 * When the highest card is full, the "current" card is the next empty one.
 */
export function buildStampCardState(
  rows: StampRow[],
  stampsPerCard: number = STAMPS_PER_CARD,
): StampCardSnapshot {
  const byCard = new Map<number, string[]>();
  for (const row of rows) {
    const list = byCard.get(row.card_number) ?? [];
    list.push(row.stamp_date);
    byCard.set(row.card_number, list);
  }
  for (const dates of byCard.values()) {
    dates.sort();
  }

  const cardNumbers = [...byCard.keys()].sort((a, b) => a - b);
  let currentCard = 1;
  if (cardNumbers.length > 0) {
    const maxCard = cardNumbers[cardNumbers.length - 1]!;
    const maxCount = byCard.get(maxCard)?.length ?? 0;
    currentCard = maxCount >= stampsPerCard ? maxCard + 1 : maxCard;
  }

  const stampedDates = byCard.get(currentCard) ?? [];
  const pastCards = cardNumbers
    .filter((n) => n < currentCard)
    .map((n) => {
      const stamp_dates = byCard.get(n) ?? [];
      return {
        card_number: n,
        stamp_dates,
        stamp_count: stamp_dates.length,
      };
    });

  return {
    card_number: currentCard,
    stamps_per_card: stampsPerCard,
    stamped_dates: stampedDates,
    filled_count: stampedDates.length,
    past_cards: pastCards,
  };
}

/**
 * Which card number should receive the next stamp for `stampDate`.
 * Same-day duplicates are handled by the caller (unique constraint / no-op).
 */
export function nextStampCardNumber(
  rows: StampRow[],
  stampsPerCard: number = STAMPS_PER_CARD,
): number {
  return buildStampCardState(rows, stampsPerCard).card_number;
}
