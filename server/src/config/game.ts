/** Game tuning knobs — XP / levels (Issue #11); streaks land in later Issues. */

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
};

export function progressSnapshotFromXp(totalXp: number): ProgressSnapshot {
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
  };
}

/** Short Mochi celebration when the user levels up. */
export function levelUpMessage(level: number): string {
  return `★ Level ${level}! Mochi is hopping with joy — you're growing so gently. ♡`;
}
