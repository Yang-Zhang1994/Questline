import { z } from 'zod';
import { MilestoneGoalSummarySchema, MilestoneSchema } from './milestone.js';
import { QuestPlanDraftSchema, QuestSchema } from './quest.js';

export const QuestPlanResponseSchema = z.object({
  draft: QuestPlanDraftSchema.nullable(),
  /** True once quests were confirmed (or already present from seed). */
  confirmed: z.boolean(),
  goal: MilestoneGoalSummarySchema.nullable(),
  milestone: MilestoneSchema.nullable(),
  quests: z.array(QuestSchema),
});

export type QuestPlanResponse = z.infer<typeof QuestPlanResponseSchema>;

export const ReviseQuestPlanBodySchema = z.object({
  feedback: z.string().trim().min(1).max(2000).optional(),
});

export type ReviseQuestPlanBody = z.infer<typeof ReviseQuestPlanBodySchema>;

export const ConfirmQuestPlanBodySchema = z.object({
  draft: QuestPlanDraftSchema,
});

export type ConfirmQuestPlanBody = z.infer<typeof ConfirmQuestPlanBodySchema>;

export const ConfirmQuestPlanResponseSchema = z.object({
  goal: MilestoneGoalSummarySchema,
  milestone: MilestoneSchema,
  quests: z.array(QuestSchema),
});

export type ConfirmQuestPlanResponse = z.infer<typeof ConfirmQuestPlanResponseSchema>;
