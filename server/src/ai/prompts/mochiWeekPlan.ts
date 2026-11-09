import type {
  Milestone,
  MilestoneGoalSummary,
  Quest,
  WeekPlanDraft,
} from '@questline/shared';
import { IsoDateSchema } from '@questline/shared';
import {
  DEFAULT_TIME_BUDGET_MINUTES,
  MAX_QUEST_MINUTES,
} from '../../config/game.js';
import { resolveDailyBudget } from './mochiQuestPlan.js';

/**
 * System prompt for proposing / revising a 7-day week plan for the current milestone.
 * JSON only — confirm-before-save happens in the service layer (Issue #15).
 */
export const MOCHI_WEEK_PLAN_SYSTEM_PROMPT = `You are Mochi, a warm cozy guide in Questline (a life-sim quest diary).

The user wants a plan for the NEXT 7 DAYS of Quests for their CURRENT milestone (stage).
Look at what's already scheduled and completed, then propose NEW tiny quests only —
never duplicate existing titles (case-insensitive) on the same due_date.

Reply with ONLY a JSON object (no markdown fences) matching:
{
  "week_start": "YYYY-MM-DD",
  "week_end": "YYYY-MM-DD",
  "quests": [
    {
      "title": string,                 // short actionable NEW task
      "due_date": "YYYY-MM-DD",        // within week_start..week_end
      "estimated_minutes": number      // positive integer, typically 5–30, max 45
    }
  ],
  "mochi_message": string              // short warm note, NO question marks, NO guilt
}

Rules:
- Plan ONLY for the current milestone. Propose NEW quests; do not re-list existing ones.
- No duplicates: do not reuse a title that already exists on that due_date (completed or not).
- Prefer titles that are clearly distinct from existing incomplete quest titles.
- Each due_date must stay within week_start..week_end (inclusive).
- For each due_date, SUM of estimated_minutes of NEW quests + already-scheduled incomplete
  quests on that day must be ≤ the user's daily time budget.
- Prefer 1–2 new quests per day; leave rest days when the remaining budget is tiny.
- Titles are concrete verbs ("Read 2 pages…"), never vague ("Work on Japanese").
- Warm, short Mochi voice — never guilt-tripping. Prefer wording like
  "Here's a gentle week of tiny steps." Never say "behind", "failed", "should have", or "lazy".
- Do NOT ask questions (no "?" in mochi_message).
- When revising from feedback: add, remove, rename, or re-time as asked while staying in budget.`;

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function weekWindow(today: string): { weekStart: string; weekEnd: string } {
  return { weekStart: today, weekEnd: addDays(today, 6) };
}

export type DayLoad = Map<string, number>;

/** Minute load for incomplete quests already on the calendar. */
export function buildExistingDayLoad(existingQuests: Quest[]): DayLoad {
  const load: DayLoad = new Map();
  for (const quest of existingQuests) {
    if (quest.completed_at !== null) continue;
    const mins = quest.estimated_minutes ?? 10;
    load.set(quest.due_date, (load.get(quest.due_date) ?? 0) + mins);
  }
  return load;
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Titles already used on a given due_date (completed or not) — block duplicates. */
export function existingTitlesByDate(existingQuests: Quest[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const quest of existingQuests) {
    const key = quest.due_date;
    const set = map.get(key) ?? new Set<string>();
    set.add(normalizeTitle(quest.title));
    map.set(key, set);
  }
  return map;
}

/**
 * Sum NEW draft minutes + existing incomplete load; returns first overflowing day, or null.
 */
export function findWeekPlanBudgetOverflow(
  draft: WeekPlanDraft,
  existingQuests: Quest[],
  dailyBudget: number,
): string | null {
  const load = buildExistingDayLoad(existingQuests);
  for (const quest of draft.quests) {
    load.set(quest.due_date, (load.get(quest.due_date) ?? 0) + quest.estimated_minutes);
  }
  for (const [day, total] of [...load.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (total > dailyBudget) return day;
  }
  return null;
}

/** True when draft reuses an existing title on the same due_date. */
export function findWeekPlanDuplicate(
  draft: WeekPlanDraft,
  existingQuests: Quest[],
): string | null {
  const byDate = existingTitlesByDate(existingQuests);
  const seenInDraft = new Map<string, Set<string>>();
  for (const quest of draft.quests) {
    const title = normalizeTitle(quest.title);
    const existing = byDate.get(quest.due_date);
    if (existing?.has(title)) {
      return quest.title;
    }
    const daySet = seenInDraft.get(quest.due_date) ?? new Set<string>();
    if (daySet.has(title)) {
      return quest.title;
    }
    daySet.add(title);
    seenInDraft.set(quest.due_date, daySet);
  }
  return null;
}

type QuestSeed = { title: string; minutes: number };

function weekSeeds(goal: MilestoneGoalSummary, milestone: Milestone): QuestSeed[] {
  const stage = milestone.title.trim() || 'this stage';
  const start = (goal.starting_point ?? 'where I am').trim();
  return [
    { title: `Take a gentle step on "${stage}"`, minutes: 10 },
    { title: `Note one soft win from "${start}"`, minutes: 5 },
    { title: `Practice a tiny piece of "${stage}" aloud`, minutes: 10 },
    { title: `Skim yesterday's notes for "${stage}"`, minutes: 8 },
    { title: `Try one fresh angle on "${stage}"`, minutes: 15 },
    { title: `Celebrate a soft checkpoint on "${stage}"`, minutes: 5 },
    { title: `Stack two cozy minutes onto "${stage}"`, minutes: 10 },
  ];
}

/**
 * Soft local draft when Claude is unavailable — keeps demos/tests working.
 * Fills remaining budget across the next 7 days without duplicating titles.
 */
export function buildEchoWeekPlan(
  goal: MilestoneGoalSummary,
  milestone: Milestone,
  existingQuests: Quest[],
  today: string,
  feedback?: string,
): WeekPlanDraft {
  const budget = resolveDailyBudget(goal) || DEFAULT_TIME_BUDGET_MINUTES;
  const { weekStart, weekEnd } = weekWindow(today);
  const load = buildExistingDayLoad(existingQuests);
  const titlesByDate = existingTitlesByDate(existingQuests);
  const seeds = weekSeeds(goal, milestone);

  let dayCount = 7;
  const note = feedback?.trim().toLowerCase() ?? '';
  if (/\b(fewer|less|lighter|simpler)\b/.test(note)) dayCount = 5;
  if (/\b(more|extra|add|another)\b/.test(note)) dayCount = 7;

  const quests: WeekPlanDraft['quests'] = [];
  let seedIndex = 0;
  for (let day = 0; day < dayCount; day++) {
    const due = addDays(weekStart, day);
    if (due > weekEnd) break;
    let remaining = budget - (load.get(due) ?? 0);
    if (remaining < 5) continue;

    const dayTitles = titlesByDate.get(due) ?? new Set<string>();
    let added = 0;
    while (remaining >= 5 && added < 2) {
      const seed = seeds[seedIndex % seeds.length];
      seedIndex += 1;
      let title = seed.title;
      if (feedback?.trim() && /\brename\b/i.test(feedback) && quests.length === 0) {
        title = `Renamed: ${title}`;
      }
      // Avoid colliding with existing or already-proposed titles that day.
      let attempts = 0;
      while (
        (dayTitles.has(normalizeTitle(title)) ||
          quests.some(
            (q) => q.due_date === due && normalizeTitle(q.title) === normalizeTitle(title),
          )) &&
        attempts < seeds.length + 2
      ) {
        attempts += 1;
        title = `${seed.title} · day ${day + 1}${attempts > 1 ? ` (${attempts})` : ''}`;
      }
      if (dayTitles.has(normalizeTitle(title))) break;

      let minutes = Math.min(seed.minutes, remaining, MAX_QUEST_MINUTES);
      if (minutes < 5) break;
      if (remaining < minutes * 2 && remaining >= 5) {
        minutes = Math.min(minutes, Math.max(5, Math.floor(remaining / 2)));
      }

      quests.push({ title, due_date: due, estimated_minutes: minutes });
      remaining -= minutes;
      added += 1;
      dayTitles.add(normalizeTitle(title));
    }
  }

  if (quests.length === 0) {
    // Guarantee at least one tiny quest on the first day with spare budget.
    for (let day = 0; day < 7; day++) {
      const due = addDays(weekStart, day);
      const remaining = budget - (load.get(due) ?? 0);
      if (remaining < 5) continue;
      quests.push({
        title: `One cozy minute on "${milestone.title.trim() || 'this stage'}"`,
        due_date: due,
        estimated_minutes: Math.min(5, remaining),
      });
      break;
    }
  }

  if (feedback?.trim() && /\breorder|swap\b/i.test(feedback) && quests.length >= 2) {
    const a = quests[0];
    const b = quests[1];
    quests[0] = b;
    quests[1] = a;
  }

  return {
    week_start: weekStart,
    week_end: weekEnd,
    quests,
    mochi_message: feedback?.trim()
      ? "Tweaked your week — here's a gentler set of tiny steps."
      : "Here's a gentle week of tiny steps — peek and change anything you like.",
  };
}

/** Clamp / repair a model draft against window, budget, and duplicates. */
export function normalizeWeekPlan(
  raw: WeekPlanDraft,
  goal: MilestoneGoalSummary,
  milestone: Milestone,
  existingQuests: Quest[],
  today: string,
): WeekPlanDraft {
  const { weekStart, weekEnd } = weekWindow(today);
  const budget = resolveDailyBudget(goal) || DEFAULT_TIME_BUDGET_MINUTES;
  const load = buildExistingDayLoad(existingQuests);
  const titlesByDate = existingTitlesByDate(existingQuests);

  const start =
    IsoDateSchema.safeParse(raw.week_start).success && raw.week_start >= today
      ? raw.week_start
      : weekStart;
  const end =
    IsoDateSchema.safeParse(raw.week_end).success && raw.week_end >= start
      ? raw.week_end > addDays(start, 6)
        ? addDays(start, 6)
        : raw.week_end
      : weekEnd;

  const quests: WeekPlanDraft['quests'] = [];
  for (const item of raw.quests) {
    if (!IsoDateSchema.safeParse(item.due_date).success) continue;
    if (item.due_date < start || item.due_date > end) continue;
    const title = item.title.trim();
    if (!title) continue;
    const minutes = Math.min(
      Math.max(1, Math.round(item.estimated_minutes)),
      MAX_QUEST_MINUTES,
    );
    const used = titlesByDate.get(item.due_date) ?? new Set<string>();
    if (used.has(normalizeTitle(title))) continue;
    if (
      quests.some(
        (q) => q.due_date === item.due_date && normalizeTitle(q.title) === normalizeTitle(title),
      )
    ) {
      continue;
    }
    const dayLoad = (load.get(item.due_date) ?? 0) + minutes;
    const alreadyProposed = quests
      .filter((q) => q.due_date === item.due_date)
      .reduce((sum, q) => sum + q.estimated_minutes, 0);
    if (dayLoad + alreadyProposed > budget) continue;
    quests.push({ title, due_date: item.due_date, estimated_minutes: minutes });
    used.add(normalizeTitle(title));
    titlesByDate.set(item.due_date, used);
  }

  if (quests.length === 0) {
    return buildEchoWeekPlan(goal, milestone, existingQuests, today);
  }

  let mochi = raw.mochi_message?.trim() || "Here's a gentle week of tiny steps.";
  mochi = mochi.replace(/\?/g, '.');
  if (/\b(behind|failed|lazy|should have|guilt)\b/i.test(mochi)) {
    mochi = "Here's a gentle week of tiny steps — peek and change anything you like.";
  }

  return {
    week_start: start,
    week_end: end,
    quests,
    mochi_message: mochi.slice(0, 1000),
  };
}
