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

/** Past completed stamp card snapshot (#13). */
export const StampPastCardSchema = z.object({
  card_number: z.number().int().positive(),
  stamp_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')),
  stamp_count: z.number().int().nonnegative(),
});

export type StampPastCard = z.infer<typeof StampPastCardSchema>;

/** Active stamp card + past cards history for the logged-in user (#13). */
export const StampCardSchema = z.object({
  card_number: z.number().int().positive(),
  stamps_per_card: z.number().int().positive(),
  stamped_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')),
  filled_count: z.number().int().nonnegative(),
  past_cards: z.array(StampPastCardSchema),
});

export type StampCard = z.infer<typeof StampCardSchema>;

