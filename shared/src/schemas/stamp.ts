import { z } from 'zod';

const StampDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/** A completed (or in-progress historical) stamp card kept for history (#13). */
export const StampPastCardSchema = z.object({
  card_number: z.number().int().positive(),
  stamp_dates: z.array(StampDateSchema),
  stamp_count: z.number().int().nonnegative(),
});

export type StampPastCard = z.infer<typeof StampPastCardSchema>;

/**
 * Current stamp card snapshot for the Today HUD (#13).
 * Fixed `stamps_per_card` slots; filled slots listed as local YYYY-MM-DD dates.
 */
export const StampCardSchema = z.object({
  card_number: z.number().int().positive(),
  stamps_per_card: z.number().int().positive(),
  /** Local dates stamped on the current card (length ≤ stamps_per_card). */
  stamped_dates: z.array(StampDateSchema),
  filled_count: z.number().int().nonnegative(),
  /** Prior cards (full or partial) kept for history. */
  past_cards: z.array(StampPastCardSchema),
});

export type StampCard = z.infer<typeof StampCardSchema>;
