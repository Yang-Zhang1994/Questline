import { z } from 'zod';
import { MilestoneSchema, RoadmapGoalSchema } from './roadmap.js';

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

/** Default starting window length in days (today + next 2 days = 3 days). */
export const QUEST_GENERATION_WINDOW_DAYS = 3;

export const QuestSchema = z.object({
  id: z.number().int().positive(),
  milestone_id: z.number().int().positive(),
  title: z.string().min(1),
  due_date: IsoDateSchema,
  estimated_minutes: z.number().int().positive().nullable(),
  completed_at: IsoDateTimeSchema.nullable(),
});

export type Quest = z.infer<typeof QuestSchema>;

export const ProposedQuestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Quest title is required')
    .max(200, 'Quest title is too long (max 200 characters)'),
  due_date: IsoDateSchema,
  estimated_minutes: z
    .number()
    .int('Quest estimated_minutes must be a whole number')
    .positive('Quest estimated_minutes must be positive'),
});

export type ProposedQuest = z.infer<typeof ProposedQuestSchema>;

export const ProposedQuestListSchema = z
  .array(ProposedQuestSchema)
  .min(1, 'At least one quest is required');

export type ProposedQuestList = z.infer<typeof ProposedQuestListSchema>;

export type QuestProposalValidationOptions = {
  windowStart: string;
  windowEnd: string;
  milestoneTargetDate?: string | null;
  timeBudgetMinutesPerDay: number;
};

/**
 * Builds a Zod schema for AI-proposed daily quests that enforces:
 * - non-empty title and positive integer estimated_minutes (via ProposedQuestSchema)
 * - each quest `due_date` is within `[windowStart, windowEnd]`
 * - each quest `due_date` is not after `milestoneTargetDate` (when present)
 * - total `estimated_minutes` per `due_date` does not exceed `timeBudgetMinutesPerDay`
 */
export function createQuestProposalListSchema(options: QuestProposalValidationOptions) {
  const { windowStart, windowEnd, milestoneTargetDate, timeBudgetMinutesPerDay } = options;

  return ProposedQuestListSchema.superRefine((quests, ctx) => {
    const minutesByDate = new Map<string, number>();

    for (let i = 0; i < quests.length; i += 1) {
      const quest = quests[i];

      if (quest.due_date < windowStart || quest.due_date > windowEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'due_date'],
          message: `Quest due_date (${quest.due_date}) must be within the window ${windowStart}..${windowEnd}`,
        });
      }

      if (milestoneTargetDate && quest.due_date > milestoneTargetDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'due_date'],
          message: `Quest due_date (${quest.due_date}) must not be after the milestone target date (${milestoneTargetDate})`,
        });
      }

      const nextTotal = (minutesByDate.get(quest.due_date) ?? 0) + quest.estimated_minutes;
      minutesByDate.set(quest.due_date, nextTotal);
    }

    for (const [date, totalMinutes] of minutesByDate.entries()) {
      if (totalMinutes > timeBudgetMinutesPerDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['quests'],
          message: `Total estimated_minutes on ${date} (${totalMinutes}) exceeds daily time budget (${timeBudgetMinutesPerDay})`,
        });
      }
    }
  });
}

export const QuestGenerationAiResponseSchema = z.object({
  quests: ProposedQuestListSchema,
});

export type QuestGenerationAiResponse = z.infer<typeof QuestGenerationAiResponseSchema>;

export const CurrentMilestoneQuestsResponseSchema = z.object({
  goal: RoadmapGoalSchema.nullable(),
  milestone: MilestoneSchema.nullable(),
  window_start: IsoDateSchema,
  window_end: IsoDateSchema,
  quests: z.array(QuestSchema),
});

export type CurrentMilestoneQuestsResponse = z.infer<typeof CurrentMilestoneQuestsResponseSchema>;

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
