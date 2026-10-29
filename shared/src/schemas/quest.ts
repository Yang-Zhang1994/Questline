import { z } from 'zod';

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

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
  done_count: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
});

export type TodayQuestsResponse = z.infer<typeof TodayQuestsResponseSchema>;

export const ToggleQuestCompletionBodySchema = z.object({
  completed: z.boolean(),
});

export type ToggleQuestCompletionBody = z.infer<typeof ToggleQuestCompletionBodySchema>;

export const ToggleQuestCompletionResponseSchema = z.object({
  quest: QuestSchema,
});

export type ToggleQuestCompletionResponse = z.infer<typeof ToggleQuestCompletionResponseSchema>;
