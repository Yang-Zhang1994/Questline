import { z } from 'zod';

const IsoDatePatternSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const GoalStatusSchema = z.enum(['active', 'paused', 'completed', 'archived']);
export type GoalStatus = z.infer<typeof GoalStatusSchema>;

export const MilestoneStatusSchema = z.enum(['upcoming', 'current', 'completed']);
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;

export const RoadmapGoalSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  done_definition: z.string().nullable().optional(),
  starting_point: z.string().nullable().optional(),
  time_budget_minutes_per_day: z.number().int().positive().nullable().optional(),
  deadline: IsoDatePatternSchema.nullable(),
  status: GoalStatusSchema,
});
export type RoadmapGoal = z.infer<typeof RoadmapGoalSchema>;

export const MilestoneSchema = z.object({
  id: z.number().int().positive(),
  goal_id: z.number().int().positive(),
  position: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().nullable(),
  target_date: IsoDatePatternSchema.nullable(),
  status: MilestoneStatusSchema,
  done_quests: z.number().int().nonnegative().optional(),
  total_quests: z.number().int().nonnegative().optional(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

export const RoadmapResponseSchema = z.object({
  goal: RoadmapGoalSchema.nullable(),
  milestones: z.array(MilestoneSchema),
});
export type RoadmapResponse = z.infer<typeof RoadmapResponseSchema>;
