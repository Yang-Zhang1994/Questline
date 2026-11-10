import { z } from 'zod';
import { IsoDateTimeSchema } from './quest.js';

/** Goal lifecycle — one `active` per user for Today / Map / Talk (#18). */
export const GoalStatusSchema = z.enum(['active', 'paused', 'completed', 'archived']);

export type GoalStatus = z.infer<typeof GoalStatusSchema>;

/** Persisted Goal row (Issues #4 / #18). */
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

/** Selector list — excludes soft-archived rows replaced by a newer confirm. */
export const GoalsListResponseSchema = z.object({
  goals: z.array(GoalSchema),
  active_goal_id: z.number().int().positive().nullable(),
});

export type GoalsListResponse = z.infer<typeof GoalsListResponseSchema>;

export const ActivateGoalResponseSchema = z.object({
  goal: GoalSchema,
  goals: z.array(GoalSchema),
  active_goal_id: z.number().int().positive(),
});

export type ActivateGoalResponse = z.infer<typeof ActivateGoalResponseSchema>;

/** Pause current active + restart Mochi interview for a fresh goal (#18). */
export const StartNewGoalResponseSchema = z.object({
  paused_goal_id: z.number().int().positive().nullable(),
  goals: z.array(GoalSchema),
  active_goal_id: z.number().int().positive().nullable(),
});

export type StartNewGoalResponse = z.infer<typeof StartNewGoalResponseSchema>;

export const DeleteGoalResponseSchema = z.object({
  deleted_goal_id: z.number().int().positive(),
  goals: z.array(GoalSchema),
  active_goal_id: z.number().int().positive().nullable(),
});

export type DeleteGoalResponse = z.infer<typeof DeleteGoalResponseSchema>;
