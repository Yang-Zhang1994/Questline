import { z } from 'zod';
import { ChatMessageSchema } from './chat.js';
import { IsoDateSchema } from './quest.js';
import { MilestoneSchema, RoadmapGoalSchema } from './roadmap.js';

export const MIN_MILESTONES = 3;
export const MAX_MILESTONES = 7;

export const ProposedMilestoneSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Milestone title is required')
    .max(140, 'Milestone title is too long (max 140 characters)'),
  description: z
    .string()
    .trim()
    .min(1, 'Milestone description is required')
    .max(300, 'Milestone description is too long (max 300 characters)'),
  target_date: IsoDateSchema,
});

export type ProposedMilestone = z.infer<typeof ProposedMilestoneSchema>;

export const ProposedMilestoneListSchema = z
  .array(ProposedMilestoneSchema)
  .min(MIN_MILESTONES, `Plan must include at least ${MIN_MILESTONES} milestones`)
  .max(MAX_MILESTONES, `Plan may include at most ${MAX_MILESTONES} milestones`);

export type ProposedMilestoneList = z.infer<typeof ProposedMilestoneListSchema>;

/**
 * Builds a Zod schema for a 3–7 milestone list that also enforces:
 * - each milestone `target_date` is before (or on) the goal's deadline when a deadline exists
 * - milestone `target_date` values are in non-decreasing chronological order
 */
export function createMilestoneProposalListSchema(goalDeadline?: string | null) {
  return ProposedMilestoneListSchema.superRefine((milestones, ctx) => {
    for (let i = 0; i < milestones.length; i += 1) {
      const current = milestones[i];
      if (goalDeadline && current.target_date > goalDeadline) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'target_date'],
          message: `Milestone target_date (${current.target_date}) must be before the goal deadline (${goalDeadline})`,
        });
      }
      if (i > 0 && current.target_date < milestones[i - 1].target_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'target_date'],
          message: `Milestones must be ordered chronologically (${current.target_date} is earlier than ${milestones[i - 1].target_date})`,
        });
      }
    }
  });
}

export const MilestonePlanAiResponseSchema = z.object({
  mochi_message: z.string().trim().min(1, 'Mochi message is required'),
  milestones: ProposedMilestoneListSchema,
});

export type MilestonePlanAiResponse = z.infer<typeof MilestonePlanAiResponseSchema>;

export const MilestonePlanStateResponseSchema = z.object({
  goal: RoadmapGoalSchema.nullable(),
  milestones: z.array(MilestoneSchema),
});

export type MilestonePlanStateResponse = z.infer<typeof MilestonePlanStateResponseSchema>;

export const ProposeMilestonesBodySchema = z.object({
  feedback: z
    .string()
    .trim()
    .min(1, 'Adjustment request cannot be empty')
    .max(2000, 'Adjustment request is too long (max 2000 characters)')
    .optional(),
  current_draft: ProposedMilestoneListSchema.optional(),
});

export type ProposeMilestonesBody = z.infer<typeof ProposeMilestonesBodySchema>;

export const ProposeMilestonesResponseSchema = z.object({
  goal: RoadmapGoalSchema,
  milestones: ProposedMilestoneListSchema,
  mochi_message: ChatMessageSchema,
  user_message: ChatMessageSchema.nullable(),
});

export type ProposeMilestonesResponse = z.infer<typeof ProposeMilestonesResponseSchema>;

export const ConfirmMilestonesBodySchema = z.object({
  milestones: ProposedMilestoneListSchema,
});

export type ConfirmMilestonesBody = z.infer<typeof ConfirmMilestonesBodySchema>;

export const ConfirmMilestonesResponseSchema = z.object({
  goal: RoadmapGoalSchema,
  milestones: z.array(MilestoneSchema),
});

export type ConfirmMilestonesResponse = z.infer<typeof ConfirmMilestonesResponseSchema>;
