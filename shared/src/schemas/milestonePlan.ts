import { z } from 'zod';
import { ChatMessageSchema } from './chat.js';
import { IsoDateSchema } from './quest.js';
import { MilestoneSchema, RoadmapGoalSchema } from './roadmap.js';

export const MIN_MILESTONES = 3;
export const MAX_MILESTONES = 7;

function isValidIsoDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return false;
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  );
}

function defaultTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function oneYearFromIsoDate(baseYmd: string): string {
  const safeBase = isValidIsoDate(baseYmd) ? baseYmd : defaultTodayIsoDate();
  const [y, m, d] = safeBase.split('-').map(Number);
  const targetYear = y + 1;
  const maxDay = new Date(Date.UTC(targetYear, m, 0)).getUTCDate();
  const clampedDay = Math.min(d, maxDay);
  return `${targetYear}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Extracts a valid YYYY-MM-DD calendar date from a deadline string (which may be
 * a clean date or free text containing a date), or returns null if none is found.
 */
export function extractGoalDeadlineDate(
  deadlineText: string | null | undefined,
): string | null {
  if (deadlineText) {
    const matches = deadlineText.match(/\d{4}-\d{2}-\d{2}/g);
    if (matches) {
      for (const candidate of matches) {
        if (isValidIsoDate(candidate)) {
          return candidate;
        }
      }
    }
  }
  return null;
}

/**
 * Resolves a goal's deadline (which may be a clean YYYY-MM-DD, free text containing
 * a YYYY-MM-DD date, or free text without any date) into a concrete YYYY-MM-DD date.
 * - If `deadlineText` contains a valid YYYY-MM-DD date, returns that date.
 * - Otherwise returns one year from `today`.
 */
export function resolveGoalDeadlineDate(
  deadlineText: string | null | undefined,
  today?: string,
): string {
  return (
    extractGoalDeadlineDate(deadlineText) ??
    oneYearFromIsoDate(today ?? defaultTodayIsoDate())
  );
}

export const ProposedMilestoneSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Milestone title is required')
    .max(140, 'Milestone title is too long (max 140 characters)'),
  description: z
    .string()
    .trim()
    .min(1, 'Milestone description is required')
    .max(300, 'Milestone description is too long (max 300 characters)'),
  target_date: IsoDateSchema,
});

export type ProposedMilestone = z.infer<typeof ProposedMilestoneSchema>;

export const ProposedMilestoneListSchema = z
  .array(ProposedMilestoneSchema)
  .min(MIN_MILESTONES, `Plan must include at least ${MIN_MILESTONES} milestones`)
  .max(MAX_MILESTONES, `Plan may include at most ${MAX_MILESTONES} milestones`);

export type ProposedMilestoneList = z.infer<typeof ProposedMilestoneListSchema>;

/**
 * Builds a Zod schema for a 3–7 milestone list that also enforces:
 * - each milestone `target_date` is before (or on) the resolved goal deadline
 * - milestone `target_date` values are in non-decreasing chronological order
 */
export function createMilestoneProposalListSchema(
  goalDeadline?: string | null,
  today?: string,
) {
  const effectiveDeadline =
    goalDeadline !== undefined && goalDeadline !== null
      ? resolveGoalDeadlineDate(goalDeadline, today)
      : today
        ? resolveGoalDeadlineDate(null, today)
        : null;

  return ProposedMilestoneListSchema.superRefine((milestones, ctx) => {
    for (let i = 0; i < milestones.length; i += 1) {
      const current = milestones[i];
      if (effectiveDeadline && current.target_date > effectiveDeadline) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'target_date'],
          message: `Milestone target_date (${current.target_date}) must be before the goal deadline (${effectiveDeadline})`,
        });
      }
      if (i > 0 && current.target_date < milestones[i - 1].target_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'target_date'],
          message: `Milestones must be ordered chronologically (${current.target_date} is earlier than ${milestones[i - 1].target_date})`,
        });
      }
    }
  });
}

export const MilestoneGoalSchema = RoadmapGoalSchema;

export const MilestonePlanAiResponseSchema = z.object({
  mochi_message: z.string().trim().min(1, 'Mochi message is required'),
  milestones: ProposedMilestoneListSchema,
});

export type MilestonePlanAiResponse = z.infer<typeof MilestonePlanAiResponseSchema>;

export const MilestonePlanStateResponseSchema = z.object({
  goal: MilestoneGoalSchema.nullable(),
  milestones: z.array(MilestoneSchema),
});

export type MilestonePlanStateResponse = z.infer<typeof MilestonePlanStateResponseSchema>;

export const ProposeMilestonesBodySchema = z.object({
  feedback: z
    .string()
    .trim()
    .min(1, 'Adjustment request cannot be empty')
    .max(2000, 'Adjustment request is too long (max 2000 characters)')
    .optional(),
  current_draft: ProposedMilestoneListSchema.optional(),
});

export type ProposeMilestonesBody = z.infer<typeof ProposeMilestonesBodySchema>;

export const ProposeMilestonesResponseSchema = z.object({
  goal: MilestoneGoalSchema,
  milestones: ProposedMilestoneListSchema,
  mochi_message: ChatMessageSchema,
  user_message: ChatMessageSchema.nullable(),
});

export type ProposeMilestonesResponse = z.infer<typeof ProposeMilestonesResponseSchema>;

export const ConfirmMilestonesBodySchema = z.object({
  milestones: ProposedMilestoneListSchema,
});

export type ConfirmMilestonesBody = z.infer<typeof ConfirmMilestonesBodySchema>;

export const ConfirmMilestonesResponseSchema = z.object({
  goal: MilestoneGoalSchema,
  milestones: z.array(MilestoneSchema),
});

export type ConfirmMilestonesResponse = z.infer<typeof ConfirmMilestonesResponseSchema>;
