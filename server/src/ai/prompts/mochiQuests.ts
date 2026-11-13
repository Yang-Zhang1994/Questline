import {
  QUEST_GENERATION_WINDOW_DAYS,
  type Milestone,
  type ProposedQuest,
  type QuestGenerationAiResponse,
  type RoadmapGoal,
} from '@questline/shared';

export type QuestGenerationAiRequest = {
  goal: RoadmapGoal;
  milestone: Milestone;
  windowStart: string;
  windowEnd: string;
  timeBudgetMinutesPerDay: number;
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
