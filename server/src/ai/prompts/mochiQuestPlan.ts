import type {
  Milestone,
  MilestoneGoalSummary,
  QuestPlanDraft,
} from '@questline/shared';
import { IsoDateSchema } from '@questline/shared';
import {
  DEFAULT_TIME_BUDGET_MINUTES,
  MAX_QUEST_MINUTES,
} from '../../config/game.js';

/**
 * System prompt for proposing / revising small daily quests for the current milestone.
 * JSON only — confirm-before-save happens in the service layer (Issue #7).
 */
export const MOCHI_QUEST_PLAN_SYSTEM_PROMPT = `You are Mochi, a warm cozy guide in Questline (a life-sim quest diary).

The user has a confirmed Goal and a current Milestone (stage). Your job: propose small daily Quests
for THAT milestone only — actionable in one sitting, with due dates and estimated minutes that fit
the user's daily time budget.

Reply with ONLY a JSON object (no markdown fences) matching:
{
  "quests": [
    {
      "title": string,                 // short actionable task
      "due_date": "YYYY-MM-DD",        // calendar day for the quest
      "estimated_minutes": number      // positive integer, typically 5–30, max 45
    }
  ],
  "mochi_message": string              // short warm note, NO question marks
}

Rules:
- Generate quests ONLY for the current milestone (do not invent other stages).
- Each quest must be small and doable in one sitting (usually ≤ 30 minutes; never over 45).
- For each due_date, the SUM of estimated_minutes must be ≤ the user's daily time budget.
- Spread quests across several days from today through the milestone target_date (or ~7 days if none).
- Prefer 1–3 quests per day; leave lighter days when the budget is tiny.
- Titles are concrete verbs ("Read 2 pages…"), never vague ("Work on Japanese").
- Warm, short Mochi voice — never guilt-tripping.
- Do NOT ask questions (no "?" in mochi_message).
- When revising from feedback: add, remove, rename, or re-time as asked while staying within the budget.`;

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const a = Date.UTC(sy, sm - 1, sd);
  const b = Date.UTC(ey, em - 1, ed);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function resolveDailyBudget(goal: MilestoneGoalSummary): number {
  const raw = goal.time_budget_minutes_per_day;
  if (raw == null || raw < 1) return DEFAULT_TIME_BUDGET_MINUTES;
  return raw;
}

/** Sum estimated minutes per due_date; returns first day that exceeds budget, or null. */
export function findBudgetOverflow(
  draft: QuestPlanDraft,
  dailyBudget: number,
): string | null {
  const byDay = new Map<string, number>();
  for (const quest of draft.quests) {
    byDay.set(quest.due_date, (byDay.get(quest.due_date) ?? 0) + quest.estimated_minutes);
  }
  for (const [day, total] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (total > dailyBudget) return day;
  }
  return null;
}

type QuestSeed = { title: string; minutes: number };

function questSeeds(goal: MilestoneGoalSummary, milestone: Milestone): QuestSeed[] {
  const stage = milestone.title.trim() || 'this stage';
  const start = (goal.starting_point ?? 'where I am').trim();
  return [
    { title: `Spend a cozy few minutes on "${stage}"`, minutes: 10 },
    { title: `Write down one tiny win from "${start}"`, minutes: 5 },
    { title: `Practice one small piece of "${stage}" out loud`, minutes: 10 },
    { title: `Review yesterday's notes for "${stage}"`, minutes: 8 },
    { title: `Try one slightly new angle on "${stage}"`, minutes: 15 },
    { title: `Celebrate a soft checkpoint on "${stage}"`, minutes: 5 },
  ];
}

/**
 * Soft local draft when Claude is unavailable — keeps demos/tests working.
 * Fits each day within the goal's daily time budget.
 */
export function buildEchoQuestPlan(
  goal: MilestoneGoalSummary,
  milestone: Milestone,
  today: string,
  feedback?: string,
): QuestPlanDraft {
  const budget = resolveDailyBudget(goal);
  const target =
    milestone.target_date && IsoDateSchema.safeParse(milestone.target_date).success
      ? milestone.target_date
      : addDays(today, 7);
  const span = Math.min(Math.max(daysBetween(today, target), 3), 7);
  const seeds = questSeeds(goal, milestone);

  let dayCount = span;
  const note = feedback?.trim().toLowerCase() ?? '';
  if (/\b(fewer|less|lighter|simpler)\b/.test(note)) dayCount = Math.max(3, span - 2);
  if (/\b(more|extra|add|another)\b/.test(note)) dayCount = Math.min(7, span + 1);

  const quests: QuestPlanDraft['quests'] = [];
  let seedIndex = 0;
  for (let day = 0; day < dayCount; day++) {
    const due = addDays(today, day);
    let remaining = budget;
    // 1–2 quests per day that fit the budget.
    while (remaining >= 5 && quests.filter((q) => q.due_date === due).length < 2) {
      const seed = seeds[seedIndex % seeds.length];
      seedIndex += 1;
      let minutes = Math.min(seed.minutes, remaining, MAX_QUEST_MINUTES);
      if (minutes < 5) break;
      // Prefer even chunks when budget is small.
      if (remaining < minutes * 2 && remaining >= 5) {
        minutes = Math.min(minutes, Math.max(5, Math.floor(remaining / 2)));
      }
      let title = seed.title;
      if (feedback?.trim() && /\brename\b/i.test(feedback) && quests.length === 0) {
        title = `Renamed: ${title}`;
      }
      quests.push({ title, due_date: due, estimated_minutes: minutes });
      remaining -= minutes;
      if (remaining < 5) break;
    }
  }

  if (feedback?.trim() && /\breorder|swap\b/i.test(feedback) && quests.length >= 2) {
    const a = quests[0];
    const b = quests[1];
    quests[0] = b;
    quests[1] = a;
  }

  const revisedNote = feedback?.trim()
    ? ` I adjusted the plan with your note: "${feedback.trim().slice(0, 80)}${feedback.trim().length > 80 ? '…' : ''}".`
    : '';

  return {
    quests,
    mochi_message: `Here are tiny daily quests for "${milestone.title}" — each day stays within your ${budget}-minute budget.${revisedNote} Confirm when it feels right ♡`,
  };
}

/** Normalize AI output: clamp minutes, drop invalid dates, enforce daily budget. */
export function normalizeQuestPlan(
  draft: QuestPlanDraft,
  goal: MilestoneGoalSummary,
  milestone: Milestone,
  today: string,
): QuestPlanDraft {
  const budget = resolveDailyBudget(goal);
  const target =
    milestone.target_date && IsoDateSchema.safeParse(milestone.target_date).success
      ? milestone.target_date
      : addDays(today, 7);

  const items = draft.quests
    .map((item) => {
      const parsedDate = IsoDateSchema.safeParse(item.due_date);
      const due_date = parsedDate.success ? parsedDate.data : today;
      const minutes = Math.min(
        Math.max(1, Math.round(item.estimated_minutes)),
        MAX_QUEST_MINUTES,
        budget,
      );
      return {
        title: item.title.trim() || 'A tiny cozy quest',
        due_date,
        estimated_minutes: minutes,
      };
    })
    .filter((item) => item.due_date >= today && item.due_date <= target)
    .slice(0, 21);

  if (items.length === 0) {
    return buildEchoQuestPlan(goal, milestone, today);
  }

  // Enforce per-day budget by trimming overflow quests (keep earlier ones).
  const used = new Map<string, number>();
  const kept: typeof items = [];
  for (const item of items) {
    const soFar = used.get(item.due_date) ?? 0;
    if (soFar + item.estimated_minutes > budget) {
      const room = budget - soFar;
      if (room >= 5) {
        kept.push({ ...item, estimated_minutes: room });
        used.set(item.due_date, budget);
      }
      continue;
    }
    kept.push(item);
    used.set(item.due_date, soFar + item.estimated_minutes);
  }

  if (kept.length === 0) {
    return buildEchoQuestPlan(goal, milestone, today);
  }

  const mochi =
    draft.mochi_message.replace(/\?/g, '.').trim() ||
    `Here are tiny quests for "${milestone.title}" ♡`;

  return { quests: kept, mochi_message: mochi };
}
