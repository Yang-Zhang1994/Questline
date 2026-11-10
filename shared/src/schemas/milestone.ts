import { z } from 'zod';
import { IsoDateSchema } from './quest.js';

/** One proposed / editable milestone in a draft plan (Issue #5). */
export const MilestoneDraftItemSchema = z.object({
  position: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1000),
  /** Target date before the goal deadline — always YYYY-MM-DD. */
  target_date: IsoDateSchema,
});

export type MilestoneDraftItem = z.infer<typeof MilestoneDraftItemSchema>;

/** Full draft plan: 3–7 ordered milestones + Mochi blurb (not persisted on rows). */
export const MilestonePlanDraftSchema = z.object({
  milestones: z.array(MilestoneDraftItemSchema).min(3).max(7),
  mochi_message: z.string().trim().min(1).max(1000),
});

export type MilestonePlanDraft = z.infer<typeof MilestonePlanDraftSchema>;

export const MilestoneStatusSchema = z.enum(['upcoming', 'current', 'completed']);

export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;

/** Persisted milestone row after confirm. */
export const MilestoneSchema = z.object({
  id: z.number().int().positive(),
  goal_id: z.number().int().positive(),
  position: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().nullable(),
  target_date: IsoDateSchema.nullable(),
  status: MilestoneStatusSchema,
});

export type Milestone = z.infer<typeof MilestoneSchema>;

/** Active goal fields the plan editor needs (avoids depending on Issue #4 schemas). */
export const MilestoneGoalSummarySchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  done_definition: z.string().nullable(),
  starting_point: z.string().nullable(),
  time_budget_minutes_per_day: z.number().int().positive().nullable(),
  deadline: z.string().nullable(),
});

export type MilestoneGoalSummary = z.infer<typeof MilestoneGoalSummarySchema>;

export const MilestonePlanResponseSchema = z.object({
  draft: MilestonePlanDraftSchema.nullable(),
  /** True once milestones were confirmed (or already present from seed). */
  confirmed: z.boolean(),
  goal: MilestoneGoalSummarySchema.nullable(),
  milestones: z.array(MilestoneSchema),
});

export type MilestonePlanResponse = z.infer<typeof MilestonePlanResponseSchema>;

export const ReviseMilestonePlanBodySchema = z.object({
  feedback: z.string().trim().min(1).max(2000).optional(),
});

export type ReviseMilestonePlanBody = z.infer<typeof ReviseMilestonePlanBodySchema>;

export const ConfirmMilestonePlanBodySchema = z.object({
  draft: MilestonePlanDraftSchema,
});

export type ConfirmMilestonePlanBody = z.infer<typeof ConfirmMilestonePlanBodySchema>;

export const ConfirmMilestonePlanResponseSchema = z.object({
  goal: MilestoneGoalSummarySchema,
  milestones: z.array(MilestoneSchema),
});

export type ConfirmMilestonePlanResponse = z.infer<typeof ConfirmMilestonePlanResponseSchema>;

/** Response after the user confirms a stage clear (confirm-before-save). */
export const CompleteStageResponseSchema = z.object({
  completed_milestone: MilestoneSchema,
  /** Next stage now marked `current`, or null when the goal is finished. */
  next_milestone: MilestoneSchema.nullable(),
  goal_completed: z.boolean(),
  goal: MilestoneGoalSummarySchema,
  milestones: z.array(MilestoneSchema),
  mochi_message: z.string().trim().min(1).max(1000),
});

export type CompleteStageResponse = z.infer<typeof CompleteStageResponseSchema>;
