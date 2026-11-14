import {
  QUEST_GENERATION_WINDOW_DAYS,
  WEEK_PLAN_WINDOW_DAYS,
  normalizeQuestTitle,
  type Milestone,
  type ProposedQuest,
  type Quest,
  type QuestGenerationAiResponse,
  type RoadmapGoal,
  type WeekPlanAiResponse,
} from '@questline/shared';
import type { ClaudeChatTurn } from '../client.js';

export type QuestGenerationAiRequest = {
  goal: RoadmapGoal;
  milestone: Milestone;
  windowStart: string;
  windowEnd: string;
  timeBudgetMinutesPerDay: number;
};

export type WeekPlanAiRequest = {
  goal: RoadmapGoal;
  milestone: Milestone;
  windowStart: string;
  windowEnd: string;
  timeBudgetMinutesPerDay: number;
  existingQuests: Quest[];
  history?: ClaudeChatTurn[];
  current_draft?: ProposedQuest[];
  feedback?: string;
};

/** System prompt for breaking the current milestone into daily quests (Issue #7). */
export const MOCHI_QUESTS_SYSTEM_PROMPT = `You are Mochi, a warm, cozy AI guide in Questline (a life-sim quest diary).

Your job is to break the user's CURRENT milestone into small, actionable daily quests for the requested date window.

Quest rules:
- Generate quests ONLY for the current milestone provided in the payload.
- Every quest must be small, concrete, and doable in a single sitting (for example: "Read 2 pages of chapter 1", "Practice 10 katakana characters").
- Each quest MUST have:
  - "title": short, specific, actionable task title (under 140 characters, non-empty)
  - "due_date": YYYY-MM-DD calendar date within [window_start, window_end] and NOT after milestone.target_date
  - "estimated_minutes": positive whole number of minutes (e.g. 10, 15, 20)
- For EVERY calendar date in the window, the sum of "estimated_minutes" for quests due on that date MUST NOT exceed "time_budget_minutes_per_day".
- Include at least 1 quest per day in the window so the user has a clear next step without feeling overwhelmed.

You MUST respond with a single JSON object and nothing else:
{
  "quests": [
    {
      "title": string,
      "due_date": "YYYY-MM-DD",
      "estimated_minutes": number
    }
  ]
}`;

function parseUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysUtc(ymd: string, days: number): string {
  const dt = parseUtcDate(ymd);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatUtcDate(dt);
}

/**
 * Computes the starting quest generation window `[windowStart, windowEnd]`:
 * defaults to `today` through `today + (QUEST_GENERATION_WINDOW_DAYS - 1)` days,
 * clamped so `windowEnd` never exceeds `milestoneTargetDate` when `milestoneTargetDate >= today`.
 */
export function computeQuestGenerationWindow(
  today: string,
  milestoneTargetDate: string | null,
  windowDays: number = QUEST_GENERATION_WINDOW_DAYS,
): { windowStart: string; windowEnd: string } {
  const defaultEnd = addDaysUtc(today, Math.max(0, windowDays - 1));
  if (milestoneTargetDate && milestoneTargetDate >= today && milestoneTargetDate < defaultEnd) {
    return { windowStart: today, windowEnd: milestoneTargetDate };
  }
  return { windowStart: today, windowEnd: defaultEnd };
}

export function listDatesInWindow(windowStart: string, windowEnd: string): string[] {
  const dates: string[] = [];
  let cursor = windowStart;
  let guard = 0;
  while (cursor <= windowEnd && guard < 31) {
    dates.push(cursor);
    cursor = addDaysUtc(cursor, 1);
    guard += 1;
  }
  return dates.length > 0 ? dates : [windowStart];
}

export function buildQuestGenerationUserPayload(input: QuestGenerationAiRequest): string {
  return JSON.stringify(
    {
      window_start: input.windowStart,
      window_end: input.windowEnd,
      time_budget_minutes_per_day: input.timeBudgetMinutesPerDay,
      goal: {
        title: input.goal.title,
        done_definition: input.goal.done_definition ?? null,
        starting_point: input.goal.starting_point ?? null,
        deadline: input.goal.deadline ?? null,
      },
      current_milestone: {
        title: input.milestone.title,
        description: input.milestone.description ?? null,
        target_date: input.milestone.target_date ?? null,
      },
    },
    null,
    2,
  );
}

/** Deterministic fallback for `createEchoChatClient` when `ANTHROPIC_API_KEY` is unset. */
export function buildDefaultQuestProposal(
  input: QuestGenerationAiRequest,
): QuestGenerationAiResponse {
  const dates = listDatesInWindow(input.windowStart, input.windowEnd);
  const budget = Math.max(1, Math.floor(input.timeBudgetMinutesPerDay));
  const stageTitle = input.milestone.title;

  const stepVerbs = [
    'Warm up on the basics for',
    'Practice one small exercise for',
    'Review & jot a quick note on',
  ];

  const quests: ProposedQuest[] = [];

  for (let dayIdx = 0; dayIdx < dates.length; dayIdx += 1) {
    const dueDate = dates[dayIdx];
    const verb = stepVerbs[dayIdx % stepVerbs.length];

    if (budget >= 15) {
      const firstMinutes = Math.max(5, Math.floor(budget * 0.6));
      const secondMinutes = budget - firstMinutes;
      quests.push({
        title: `${verb} "${stageTitle}" (Day ${dayIdx + 1}, part 1)`,
        due_date: dueDate,
        estimated_minutes: firstMinutes,
      });
      if (secondMinutes > 0) {
        quests.push({
          title: `Wrap up today's mini-step for "${stageTitle}" (Day ${dayIdx + 1}, part 2)`,
          due_date: dueDate,
          estimated_minutes: secondMinutes,
        });
      }
    } else {
      quests.push({
        title: `${verb} "${stageTitle}" (Day ${dayIdx + 1})`,
        due_date: dueDate,
        estimated_minutes: budget,
      });
    }
  }

  return { quests };
}

/** System prompt for proposing or adjusting a 7-day quest plan for the current milestone (Issue #15). */
export const MOCHI_WEEK_PLAN_SYSTEM_PROMPT = `You are Mochi, a warm, cozy AI guide in Questline (a life-sim quest diary).

Your job is to propose or adjust the next week of small daily quests for the user's CURRENT milestone.
Voice rules:
- Warm, short, encouraging — never guilt-tripping.
- Keep mochi_message under ~80 words. Emoji sparingly is fine (♡ ✦ ✨ 📅).

Week planning rules:
- Generate NEW quests ONLY for the current milestone and ONLY for dates within [window_start, window_end].
- If milestone.target_date >= window_start, no quest due_date may be after milestone.target_date.
- Look at "completed_quests" (what is already done) and "scheduled_quests" (what is already scheduled) so your new quests build naturally on the user's progress.
- Keep all existing quests untouched; you are ONLY returning the new quests to add in the remaining daily time budget.
- For EVERY date in [window_start, window_end], existing_minutes_on_date + sum(new_quest.estimated_minutes on that date) MUST NOT exceed time_budget_minutes_per_day (i.e. sum of new quests on that date <= remaining_minutes_by_date[date]). If a date has 0 remaining minutes, do not schedule new quests on that date.
- Every new quest title MUST be unique and MUST NOT duplicate any title in completed_quests, scheduled_quests, or another proposed quest (case-insensitive).
- When "current_draft" and "feedback" are provided, revise the draft according to the user's feedback while still obeying the date window, remaining daily budget, and no-duplicate rules.

You MUST respond with a single JSON object and nothing else:
{
  "mochi_message": string,
  "quests": [
    {
      "title": string,
      "due_date": "YYYY-MM-DD",
      "estimated_minutes": number
    }
  ]
}`;

/**
 * Computes the 7-day week-plan window `[windowStart, windowEnd]`:
 * defaults to `today` through `today + 6` days (`WEEK_PLAN_WINDOW_DAYS = 7`),
 * clamped so `windowEnd` never exceeds `milestoneTargetDate` when `milestoneTargetDate >= today`.
 * If `milestoneTargetDate < today` (already passed), uses the full 7-day window like #7.
 */
export function computeWeekPlanWindow(
  today: string,
  milestoneTargetDate: string | null,
): { windowStart: string; windowEnd: string } {
  return computeQuestGenerationWindow(today, milestoneTargetDate, WEEK_PLAN_WINDOW_DAYS);
}

export function buildWeekPlanUserPayload(input: WeekPlanAiRequest): string {
  const dates = listDatesInWindow(input.windowStart, input.windowEnd);
  const completedQuests = input.existingQuests
    .filter((q) => q.completed_at !== null)
    .map((q) => ({
      title: q.title,
      due_date: q.due_date,
      estimated_minutes: q.estimated_minutes,
    }));
  const scheduledQuests = input.existingQuests
    .filter((q) => q.completed_at === null)
    .map((q) => ({
      title: q.title,
      due_date: q.due_date,
      estimated_minutes: q.estimated_minutes,
    }));

  const remainingMinutesByDate: Record<string, number> = {};
  for (const date of dates) {
    const used = input.existingQuests
      .filter((q) => q.due_date === date)
      .reduce((sum, q) => sum + (q.estimated_minutes && q.estimated_minutes > 0 ? q.estimated_minutes : 0), 0);
    remainingMinutesByDate[date] = Math.max(0, input.timeBudgetMinutesPerDay - used);
  }

  return JSON.stringify(
    {
      window_start: input.windowStart,
      window_end: input.windowEnd,
      time_budget_minutes_per_day: input.timeBudgetMinutesPerDay,
      remaining_minutes_by_date: remainingMinutesByDate,
      goal: {
        title: input.goal.title,
        done_definition: input.goal.done_definition ?? null,
        starting_point: input.goal.starting_point ?? null,
        deadline: input.goal.deadline ?? null,
      },
      current_milestone: {
        title: input.milestone.title,
        description: input.milestone.description ?? null,
        target_date: input.milestone.target_date ?? null,
      },
      completed_quests: completedQuests,
      scheduled_quests: scheduledQuests,
      current_draft: input.current_draft ?? null,
      feedback: input.feedback ?? null,
    },
    null,
    2,
  );
}

function makeUniqueQuestTitle(
  baseTitle: string,
  takenNormalized: Set<string>,
): string {
  const trimmed = baseTitle.trim().slice(0, 180) || 'Cozy practice step';
  let candidate = trimmed;
  let suffix = 2;
  while (takenNormalized.has(normalizeQuestTitle(candidate))) {
    candidate = `${trimmed} (#${suffix})`.slice(0, 200);
    suffix += 1;
  }
  takenNormalized.add(normalizeQuestTitle(candidate));
  return candidate;
}

/** Deterministic fallback for `createEchoChatClient.proposeWeekPlan` when `ANTHROPIC_API_KEY` is unset. */
export function buildDefaultWeekPlanProposal(
  input: WeekPlanAiRequest,
): WeekPlanAiResponse {
  const dates = listDatesInWindow(input.windowStart, input.windowEnd);
  const budget = Math.max(1, Math.floor(input.timeBudgetMinutesPerDay));
  const stageTitle = input.milestone.title;
  const takenTitles = new Set(
    input.existingQuests.map((q) => normalizeQuestTitle(q.title)),
  );

  const remainingByDate = new Map<string, number>();
  for (const date of dates) {
    const used = input.existingQuests
      .filter((q) => q.due_date === date)
      .reduce((sum, q) => sum + (q.estimated_minutes && q.estimated_minutes > 0 ? q.estimated_minutes : 0), 0);
    remainingByDate.set(date, Math.max(0, budget - used));
  }

  const trimmedFeedback = input.feedback?.trim();
  if (input.current_draft && input.current_draft.length > 0 && trimmedFeedback) {
    const lower = trimmedFeedback.toLowerCase();
    let updated = input.current_draft.map((q) => ({ ...q }));

    if ((lower.includes('fewer') || lower.includes('remove') || lower.includes('lighter')) && updated.length > 1) {
      updated = updated.slice(0, updated.length - 1);
    } else if (lower.includes('shorter') || lower.includes('quick')) {
      updated = updated.map((q) => ({
        ...q,
        estimated_minutes: Math.max(5, Math.floor(q.estimated_minutes * 0.7)),
      }));
    } else {
      updated[0] = {
        ...updated[0],
        title: `${trimmedFeedback.slice(0, 80)} — ${stageTitle}`.slice(0, 200),
      };
    }

    const sanitized: ProposedQuest[] = [];
    const usedInDraftByDate = new Map<string, number>();
    for (const item of updated) {
      const rem = (remainingByDate.get(item.due_date) ?? 0) - (usedInDraftByDate.get(item.due_date) ?? 0);
      if (rem <= 0) continue;
      const mins = Math.min(item.estimated_minutes, rem);
      const uniqueTitle = makeUniqueQuestTitle(item.title, takenTitles);
      sanitized.push({
        title: uniqueTitle,
        due_date: item.due_date,
        estimated_minutes: mins,
      });
      usedInDraftByDate.set(item.due_date, (usedInDraftByDate.get(item.due_date) ?? 0) + mins);
    }

    if (sanitized.length > 0) {
      return {
        mochi_message: `I tweaked your week plan for "${stageTitle}" based on "${trimmedFeedback}"! Take a peek at the daily steps and let me know if it feels right ♡`,
        quests: sanitized,
      };
    }
  }

  const stepVerbs = [
    'Explore a fresh step for',
    'Practice a focused mini-session on',
    'Build steady momentum on',
    'Review & deepen your notes for',
    'Try a hands-on exercise for',
    'Consolidate what you learned in',
    'Celebrate the week with a gentle wrap-up on',
  ];

  const quests: ProposedQuest[] = [];

  for (let dayIdx = 0; dayIdx < dates.length; dayIdx += 1) {
    const dueDate = dates[dayIdx];
    const remaining = remainingByDate.get(dueDate) ?? 0;
    if (remaining <= 0) {
      continue;
    }

    const verb = stepVerbs[dayIdx % stepVerbs.length];
    if (remaining >= 20) {
      const firstMinutes = Math.max(5, Math.floor(remaining * 0.6));
      const secondMinutes = remaining - firstMinutes;
      quests.push({
        title: makeUniqueQuestTitle(
          `${verb} "${stageTitle}" (${dueDate}, step 1)`,
          takenTitles,
        ),
        due_date: dueDate,
        estimated_minutes: firstMinutes,
      });
      if (secondMinutes > 0) {
        quests.push({
          title: makeUniqueQuestTitle(
            `Follow-up practice for "${stageTitle}" (${dueDate}, step 2)`,
            takenTitles,
          ),
          due_date: dueDate,
          estimated_minutes: secondMinutes,
        });
      }
    } else {
      quests.push({
        title: makeUniqueQuestTitle(
          `${verb} "${stageTitle}" (${dueDate})`,
          takenTitles,
        ),
        due_date: dueDate,
        estimated_minutes: remaining,
      });
    }
  }

  return {
    mochi_message: `Here is a cozy week plan for "${stageTitle}" from ${input.windowStart} to ${input.windowEnd}, shaped around what you've already finished and your ${budget} min/day budget ♡`,
    quests,
  };
}
