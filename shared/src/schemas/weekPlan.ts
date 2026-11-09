import { z } from 'zod';
import { MilestoneGoalSummarySchema, MilestoneSchema } from './milestone.js';
import { IsoDateSchema, QuestDraftItemSchema, QuestSchema } from './quest.js';

/**
 * Draft week plan — next ~7 days of NEW quests for the current milestone (Issue #15).
 * Confirm INSERTs quest rows; drafts never auto-write.
 */
export const WeekPlanDraftSchema = z.object({
  /** Inclusive window start (usually today). */
  week_start: IsoDateSchema,
  /** Inclusive window end (usually today + 6). */
  week_end: IsoDateSchema,
  quests: z.array(QuestDraftItemSchema).min(1).max(21),
  mochi_message: z.string().trim().min(1).max(1000),
});

export type WeekPlanDraft = z.infer<typeof WeekPlanDraftSchema>;

export const WeekPlanResponseSchema = z.object({
  draft: WeekPlanDraftSchema.nullable(),
  /** Existing quests on the current milestone (scheduled + completed). */
  existing_quests: z.array(QuestSchema),
  goal: MilestoneGoalSummarySchema.nullable(),
  milestone: MilestoneSchema.nullable(),
  /** True after the user confirmed and new quest rows were written. */
  applied: z.boolean(),
});

export type WeekPlanResponse = z.infer<typeof WeekPlanResponseSchema>;

export const ConfirmWeekPlanBodySchema = z.object({
  draft: WeekPlanDraftSchema,
});

export type ConfirmWeekPlanBody = z.infer<typeof ConfirmWeekPlanBodySchema>;

export const ConfirmWeekPlanResponseSchema = z.object({
  goal: MilestoneGoalSummarySchema,
  milestone: MilestoneSchema,
  /** Newly inserted quests from this week plan (not the full milestone list). */
  quests: z.array(QuestSchema),
  mochi_message: z.string(),
});

export type ConfirmWeekPlanResponse = z.infer<typeof ConfirmWeekPlanResponseSchema>;

export const ReviseWeekPlanBodySchema = z.object({
  feedback: z.string().trim().min(1).max(2000).optional(),
});

export type ReviseWeekPlanBody = z.infer<typeof ReviseWeekPlanBodySchema>;
