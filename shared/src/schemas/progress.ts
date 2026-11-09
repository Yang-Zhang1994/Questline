import { z } from 'zod';

/** User XP / level snapshot for HUD + completion responses (Issue #11). */
export const UserProgressSchema = z.object({
  xp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  /** XP earned within the current level (toward the next). */
  xp_into_level: z.number().int().nonnegative(),
  /** Size of the current level's XP span (floor → next threshold). */
  xp_for_next_level: z.number().int().positive(),
});

export type UserProgress = z.infer<typeof UserProgressSchema>;
