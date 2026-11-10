import { z } from 'zod';
import { UserProgressSchema } from './progress.js';
import { StampCardSchema } from './stamp.js';

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/** Current stage is ready to mark complete (all its quests done) — Issue #10. */
export const StageReadySummarySchema = z.object({
  milestone_id: z.number().int().positive(),
  milestone_title: z.string().min(1),
});

export type StageReadySummary = z.infer<typeof StageReadySummarySchema>;

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const QuestSchema = z.object({
  id: z.number().int().positive(),
  milestone_id: z.number().int().positive(),
  title: z.string().min(1),
  due_date: IsoDateSchema,
  estimated_minutes: z.number().int().positive().nullable(),
  completed_at: IsoDateTimeSchema.nullable(),
});

export type Quest = z.infer<typeof QuestSchema>;

export const TodayQuestsResponseSchema = z.object({
  local_date: IsoDateSchema,
  goal_title: z.string().nullable(),
  milestone_title: z.string().nullable(),
  greeting: z.string(),
  quests: z.array(QuestSchema),
  /** Past-due incomplete quests for the active goal (Issue #14). */
  overdue_quests: z.array(QuestSchema).default([]),
  done_count: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
  progress: UserProgressSchema,
  /** Current stamp card + past card history (#13). */
  stamp_card: StampCardSchema,
  /** True when every quest on the current milestone is done (#10). */
  stage_ready: z.boolean().default(false),
  stage_ready_milestone: StageReadySummarySchema.nullable().default(null),
});

export type TodayQuestsResponse = z.infer<typeof TodayQuestsResponseSchema>;

export const ToggleQuestCompletionBodySchema = z.object({
  completed: z.boolean(),
  /** User's local calendar date — drives streak (#12) + stamps (#13); falls back to injectable clock. */
  local_date: IsoDateSchema.optional(),
});

export type ToggleQuestCompletionBody = z.infer<typeof ToggleQuestCompletionBodySchema>;

export const ToggleQuestCompletionResponseSchema = z.object({
  quest: QuestSchema,
  progress: UserProgressSchema,
  leveled_up: z.boolean(),
  level_up_message: z.string().nullable(),
  stamp_card: StampCardSchema,
  /** True when this completion filled the last slot on the current card. */
  card_completed: z.boolean(),
  card_reward_message: z.string().nullable(),
  /** True when every quest on the current milestone is done (#10). */
  stage_ready: z.boolean().default(false),
  stage_ready_milestone: StageReadySummarySchema.nullable().default(null),
});

export type ToggleQuestCompletionResponse = z.infer<typeof ToggleQuestCompletionResponseSchema>;

/** One proposed daily quest in a draft plan (Issue #7). */
export const QuestDraftItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  due_date: IsoDateSchema,
  /** Positive minutes — doable in one sitting. */
  estimated_minutes: z.number().int().positive().max(120),
});

export type QuestDraftItem = z.infer<typeof QuestDraftItemSchema>;

/** Full draft quest plan for the current milestone + Mochi blurb. */
export const QuestPlanDraftSchema = z.object({
  quests: z.array(QuestDraftItemSchema).min(1).max(21),
  mochi_message: z.string().trim().min(1).max(1000),
});

export type QuestPlanDraft = z.infer<typeof QuestPlanDraftSchema>;
