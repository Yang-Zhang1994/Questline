import { z } from 'zod';
import { IsoDateTimeSchema } from './quest.js';
import { GoalStatusSchema } from './roadmap.js';

export type { GoalStatus } from './roadmap.js';

/** Proposed / persisted measurable goal shape (Issue #4). */
export const GoalDraftSchema = z.object({
  title: z.string().trim().min(1),
  done_definition: z.string().trim().min(1),
  starting_point: z.string().trim().min(1),
  time_budget_minutes_per_day: z.number().int().positive(),
  deadline: z.string().trim().min(1),
  /** Warm Mochi blurb shown with the card — not persisted on the Goal row. */
  mochi_message: z.string().trim().min(1),
});

export type GoalDraft = z.infer<typeof GoalDraftSchema>;

export const GoalSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  title: z.string().min(1),
  done_definition: z.string().nullable(),
  starting_point: z.string().nullable(),
  time_budget_minutes_per_day: z.number().int().positive().nullable(),
  deadline: z.string().nullable(),
  status: GoalStatusSchema,
  created_at: IsoDateTimeSchema,
});

export type Goal = z.infer<typeof GoalSchema>;

export const GoalDraftResponseSchema = z.object({
  draft: GoalDraftSchema.nullable(),
  /** True once the user has accepted and a Goal row exists for this interview. */
  confirmed: z.boolean(),
  goal: GoalSchema.nullable(),
});

export type GoalDraftResponse = z.infer<typeof GoalDraftResponseSchema>;

export const ReviseGoalDraftBodySchema = z.object({
  feedback: z.string().trim().min(1).max(2000).optional(),
});

export type ReviseGoalDraftBody = z.infer<typeof ReviseGoalDraftBodySchema>;

export const ConfirmGoalBodySchema = z.object({
  draft: GoalDraftSchema,
});

export type ConfirmGoalBody = z.infer<typeof ConfirmGoalBodySchema>;

export const ConfirmGoalResponseSchema = z.object({
  goal: GoalSchema,
});

export type ConfirmGoalResponse = z.infer<typeof ConfirmGoalResponseSchema>;
