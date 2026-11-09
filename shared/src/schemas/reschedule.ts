import { z } from 'zod';
import { MilestoneGoalSummarySchema, MilestoneSchema } from './milestone.js';
import { IsoDateSchema, QuestSchema } from './quest.js';

/** One overdue quest moved to a new due date (Issue #14). */
export const RescheduleMoveSchema = z.object({
  quest_id: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  from_date: IsoDateSchema,
  to_date: IsoDateSchema,
  estimated_minutes: z.number().int().positive().max(120).nullable(),
});

export type RescheduleMove = z.infer<typeof RescheduleMoveSchema>;

/**
 * Draft reschedule plan — persisted on the goal until confirm.
 * Confirm updates existing quest due_dates only (no new quest rows).
 */
export const RescheduleDraftSchema = z.object({
  moves: z.array(RescheduleMoveSchema).min(1).max(40),
  mochi_message: z.string().trim().min(1).max(1000),
});

export type RescheduleDraft = z.infer<typeof RescheduleDraftSchema>;

export const RescheduleResponseSchema = z.object({
  draft: RescheduleDraftSchema.nullable(),
  /** Overdue quests (past due, not done) for the active goal. */
  overdue: z.array(QuestSchema),
  goal: MilestoneGoalSummarySchema.nullable(),
  milestone: MilestoneSchema.nullable(),
  /** True after the user confirmed and due dates were written. */
  applied: z.boolean(),
});

export type RescheduleResponse = z.infer<typeof RescheduleResponseSchema>;

export const ConfirmRescheduleBodySchema = z.object({
  draft: RescheduleDraftSchema,
});

export type ConfirmRescheduleBody = z.infer<typeof ConfirmRescheduleBodySchema>;

export const ConfirmRescheduleResponseSchema = z.object({
  goal: MilestoneGoalSummarySchema,
  milestone: MilestoneSchema,
  quests: z.array(QuestSchema),
  mochi_message: z.string(),
});

export type ConfirmRescheduleResponse = z.infer<typeof ConfirmRescheduleResponseSchema>;

export const ReviseRescheduleBodySchema = z.object({
  feedback: z.string().trim().min(1).max(2000).optional(),
});

export type ReviseRescheduleBody = z.infer<typeof ReviseRescheduleBodySchema>;
