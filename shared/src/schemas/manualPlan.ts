import { z } from 'zod';
import { GoalSchema } from './goal.js';
import { IsoDateSchema } from './quest.js';
import { MilestoneSchema } from './roadmap.js';

/**
 * Manual plan form body (Issue #21).
 * Goal name + ≥1 milestone are required; concrete goal / deadline are optional helpers.
 */
export const ManualPlanBodySchema = z.object({
  /** Short goal name shown on Map / selector. */
  title: z.string().trim().min(1).max(200),
  /** Concrete, measurable “done” definition — maps to goals.done_definition. */
  concrete_goal: z
    .union([z.string().trim().max(1000), z.null()])
    .optional()
    .transform((v) => {
      if (v == null) return null;
      const trimmed = v.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
  /** Optional YYYY-MM-DD deadline. */
  deadline: z
    .union([IsoDateSchema, z.literal(''), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || v === '') return null;
      return v;
    }),
  /** One milestone title per entry (client splits textarea lines). */
  milestones: z.array(z.string().trim().min(1).max(200)).min(1).max(12),
});

export type ManualPlanBody = z.infer<typeof ManualPlanBodySchema>;

export const ManualPlanResponseSchema = z.object({
  goal: GoalSchema,
  milestones: z.array(MilestoneSchema).min(1),
});

export type ManualPlanResponse = z.infer<typeof ManualPlanResponseSchema>;
