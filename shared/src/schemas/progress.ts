import { z } from 'zod';

/** User XP / level / streak snapshot for HUD + completion responses (#11, #12). */
export const UserProgressSchema = z.object({
  xp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  /** XP earned within the current level (toward the next). */
  xp_into_level: z.number().int().nonnegative(),
  /** Size of the current level's XP span (floor → next threshold). */
  xp_for_next_level: z.number().int().positive(),
  /** Consecutive local days with ≥1 quest completed. */
  current_streak: z.number().int().nonnegative(),
  /** Highest current_streak ever reached. */
  best_streak: z.number().int().nonnegative(),
  /** Last local YYYY-MM-DD that counted as an active streak day. */
  last_active_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .nullable(),
});

export type UserProgress = z.infer<typeof UserProgressSchema>;
