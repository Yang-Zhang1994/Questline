import { z } from 'zod';
import { ChatMessageSchema } from './chat.js';
import { StampCardSchema, UserProgressSchema } from './progress.js';
import { MilestoneSchema, RoadmapGoalSchema } from './roadmap.js';

export function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

const MS_PER_DAY = 86_400_000;

function toUtcDayMidnightMs(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function calendarDayDiff(dateA: string, dateB: string): number {
  return Math.round((toUtcDayMidnightMs(dateA) - toUtcDayMidnightMs(dateB)) / MS_PER_DAY);
}

export function isLocalDateWithinOneDay(localDate: string, serverDate: string): boolean {
  if (!isRealCalendarDate(localDate) || !isRealCalendarDate(serverDate)) {
    return false;
  }
  return Math.abs(calendarDayDiff(localDate, serverDate)) <= 1;
}

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine(isRealCalendarDate, 'Expected a real calendar date (YYYY-MM-DD)');

/** Current stage is ready to mark complete (all its quests done) — Issue #10. */
export const StageReadySummarySchema = z.object({
  milestone_id: z.number().int().positive(),
  milestone_title: z.string().min(1),
});

export type StageReadySummary = z.infer<typeof StageReadySummarySchema>;

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

/** Default starting window length in days (today + next 2 days = 3 days). */
export const QUEST_GENERATION_WINDOW_DAYS = 3;

/** Week-plan window length in days (today + next 6 days = 7 days) — Issue #15. */
export const WEEK_PLAN_WINDOW_DAYS = 7;

export function normalizeQuestTitle(title: string): string {
  return title.trim().toLowerCase();
}

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
  existingQuests?: ReadonlyArray<{
    title: string;
    due_date: string;
    estimated_minutes: number | null;
  }>;
  enforceNoDuplicates?: boolean;
};

/**
 * Builds a Zod schema for AI-proposed daily quests that enforces:
 * - non-empty title and positive integer estimated_minutes (via ProposedQuestSchema)
 * - each quest `due_date` is within `[windowStart, windowEnd]`
 * - each quest `due_date` is not after `milestoneTargetDate` (when `milestoneTargetDate >= windowStart`)
 * - total `estimated_minutes` per `due_date` (including any `existingQuests` on that date) does not exceed `timeBudgetMinutesPerDay`
 * - when `enforceNoDuplicates` is true (or `existingQuests` is provided), proposed quest titles must not duplicate existing titles or each other
 */
export function createQuestProposalListSchema(options: QuestProposalValidationOptions) {
  const {
    windowStart,
    windowEnd,
    milestoneTargetDate,
    timeBudgetMinutesPerDay,
    existingQuests = [],
    enforceNoDuplicates = false,
  } = options;

  // Like computeQuestGenerationWindow (#7): only cut off at milestoneTargetDate when it hasn't already passed relative to windowStart.
  const effectiveTargetDate =
    milestoneTargetDate && milestoneTargetDate >= windowStart ? milestoneTargetDate : null;

  return ProposedQuestListSchema.superRefine((quests, ctx) => {
    const minutesByDate = new Map<string, number>();
    for (const existing of existingQuests) {
      if (existing.due_date >= windowStart && existing.due_date <= windowEnd) {
        const mins = existing.estimated_minutes && existing.estimated_minutes > 0 ? existing.estimated_minutes : 0;
        minutesByDate.set(existing.due_date, (minutesByDate.get(existing.due_date) ?? 0) + mins);
      }
    }

    const checkDuplicates = enforceNoDuplicates || existingQuests.length > 0;
    const existingTitles = new Set(existingQuests.map((q) => normalizeQuestTitle(q.title)));
    const seenProposedTitles = new Set<string>();

    for (let i = 0; i < quests.length; i += 1) {
      const quest = quests[i];

      if (quest.due_date < windowStart || quest.due_date > windowEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'due_date'],
          message: `Quest due_date (${quest.due_date}) must be within the window ${windowStart}..${windowEnd}`,
        });
      }

      if (effectiveTargetDate && quest.due_date > effectiveTargetDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'due_date'],
          message: `Quest due_date (${quest.due_date}) must not be after the milestone target date (${effectiveTargetDate})`,
        });
      }

      if (checkDuplicates) {
        const normalized = normalizeQuestTitle(quest.title);
        if (existingTitles.has(normalized)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, 'title'],
            message: `Quest title "${quest.title}" duplicates an existing quest on this milestone`,
          });
        } else if (seenProposedTitles.has(normalized)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, 'title'],
            message: `Quest title "${quest.title}" is duplicated in the proposed plan`,
          });
        }
        seenProposedTitles.add(normalized);
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

export const WeekPlanAiResponseSchema = z.object({
  mochi_message: z.string().trim().min(1, 'Mochi message is required').max(1000),
  quests: ProposedQuestListSchema,
});

export type WeekPlanAiResponse = z.infer<typeof WeekPlanAiResponseSchema>;

export const ProposeWeekPlanBodySchema = z.object({
  local_date: IsoDateSchema.optional(),
  feedback: z
    .string()
    .trim()
    .min(1, 'Adjustment request cannot be empty')
    .max(2000, 'Adjustment request is too long (max 2000 characters)')
    .optional(),
  current_draft: ProposedQuestListSchema.optional(),
});

export type ProposeWeekPlanBody = z.infer<typeof ProposeWeekPlanBodySchema>;

export const ProposeWeekPlanResponseSchema = z.object({
  goal: RoadmapGoalSchema,
  milestone: MilestoneSchema,
  window_start: IsoDateSchema,
  window_end: IsoDateSchema,
  time_budget_minutes_per_day: z.number().int().positive(),
  existing_quests: z.array(QuestSchema),
  quests: ProposedQuestListSchema,
  mochi_message: ChatMessageSchema,
  user_message: ChatMessageSchema.nullable(),
});

export type ProposeWeekPlanResponse = z.infer<typeof ProposeWeekPlanResponseSchema>;

export const ConfirmWeekPlanBodySchema = z.object({
  local_date: IsoDateSchema.optional(),
  quests: ProposedQuestListSchema,
});

export type ConfirmWeekPlanBody = z.infer<typeof ConfirmWeekPlanBodySchema>;

export const ConfirmWeekPlanResponseSchema = z.object({
  goal: RoadmapGoalSchema,
  milestone: MilestoneSchema,
  window_start: IsoDateSchema,
  window_end: IsoDateSchema,
  quests: z.array(QuestSchema),
});

export type ConfirmWeekPlanResponse = z.infer<typeof ConfirmWeekPlanResponseSchema>;

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
  /** XP / level HUD snapshot (Issue #11). */
  progress: UserProgressSchema,
  /** Stamp card snapshot + past cards (Issue #13). */
  stamp_card: StampCardSchema,
  /** True when every quest on the current milestone is done (#10). */
  stage_ready: z.boolean().default(false),
  stage_ready_milestone: StageReadySummarySchema.nullable().default(null),
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
  /** User's local calendar date — drives streak (#12) and stamps (#13); falls back to injectable clock. */
  local_date: IsoDateSchema.optional(),
});

export type ToggleQuestCompletionBody = z.infer<typeof ToggleQuestCompletionBodySchema>;

export const ToggleQuestCompletionResponseSchema = z.object({
  quest: QuestSchema,
  progress: UserProgressSchema,
  leveled_up: z.boolean(),
  level_up_message: z.string().nullable(),
  /** Stamp card snapshot after check-off / undo (Issue #13). */
  stamp_card: StampCardSchema,
  /** True when this completion just filled the last slot of a stamp card (#13). */
  card_completed: z.boolean().default(false),
  /** Mochi celebration message when a stamp card is completed (#13). */
  card_reward_message: z.string().nullable().default(null),
  /** True when every quest on the current milestone is done (#10). */
  stage_ready: z.boolean().default(false),
  stage_ready_milestone: StageReadySummarySchema.nullable().default(null),
});

export type ToggleQuestCompletionResponse = z.infer<typeof ToggleQuestCompletionResponseSchema>;
