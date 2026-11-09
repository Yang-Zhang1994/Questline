import type {
  Milestone,
  MilestoneGoalSummary,
  Quest,
  RescheduleDraft,
} from '@questline/shared';
import { IsoDateSchema } from '@questline/shared';
import {
  DEFAULT_TIME_BUDGET_MINUTES,
} from '../../config/game.js';
import { resolveDailyBudget } from './mochiQuestPlan.js';

/**
 * System prompt for proposing / revising overdue quest reschedules.
 * JSON only — confirm-before-save happens in the service layer (Issue #14).
 */
export const MOCHI_RESCHEDULE_SYSTEM_PROMPT = `You are Mochi, a warm cozy guide in Questline (a life-sim quest diary).

The user has overdue Quests (past due and not done). Your job: propose NEW due dates for
those existing quests only — never invent new quest titles or duplicate rows.

Reply with ONLY a JSON object (no markdown fences) matching:
{
  "moves": [
    {
      "quest_id": number,              // must be one of the overdue quest ids
      "title": string,                 // echo the existing title
      "from_date": "YYYY-MM-DD",       // current due date
      "to_date": "YYYY-MM-DD",         // proposed new due date (≥ today)
      "estimated_minutes": number|null
    }
  ],
  "mochi_message": string              // short warm note, NO question marks, NO guilt
}

Rules:
- Move ONLY the provided overdue quests (same quest_id / title). Do not add or drop quests.
- New to_date must be today or later, and preferably on/before the milestone target_date.
- Respect the daily time budget: for each to_date, sum of minutes (existing incomplete quests
  already on that day that are NOT being moved + moves landing that day) ≤ budget.
- Spread moves across days when needed — avoid stacking everything on one day.
- Warm, short Mochi voice — never guilt-tripping. Prefer wording like
  "Let's adjust the plan together." Never say "behind", "failed", "should have", or "lazy".
- Do NOT ask questions (no "?" in mochi_message).
- When revising from feedback: re-time as asked while staying within the budget.`;

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

export type DayLoad = Map<string, number>;

/** Build minute load for incomplete quests that are not in the overdue move set. */
export function buildFixedDayLoad(
  allQuests: Quest[],
  overdueIds: Set<number>,
): DayLoad {
  const load: DayLoad = new Map();
  for (const quest of allQuests) {
    if (overdueIds.has(quest.id)) continue;
    if (quest.completed_at !== null) continue;
    const mins = quest.estimated_minutes ?? 10;
    load.set(quest.due_date, (load.get(quest.due_date) ?? 0) + mins);
  }
  return load;
}

/**
 * Soft local draft when Claude is unavailable — keeps demos/tests working.
 * Spreads overdue quests from today forward within the daily budget.
 */
export function buildEchoReschedule(
  goal: MilestoneGoalSummary,
  milestone: Milestone,
  overdue: Quest[],
  allQuests: Quest[],
  today: string,
  feedback?: string,
): RescheduleDraft {
  const budget = resolveDailyBudget(goal) || DEFAULT_TIME_BUDGET_MINUTES;
  const overdueIds = new Set(overdue.map((q) => q.id));
  const load = buildFixedDayLoad(allQuests, overdueIds);

  const target =
    milestone.target_date && IsoDateSchema.safeParse(milestone.target_date).success
      ? milestone.target_date
      : addDays(today, 7);
  const span = Math.max(daysBetween(today, target), overdue.length);
  const dayCount = Math.min(Math.max(span, overdue.length), 14);

  let startOffset = 0;
  const note = feedback?.trim().toLowerCase() ?? '';
  if (/\b(later|postpone|push)\b/.test(note)) startOffset = 1;
  if (/\b(sooner|earlier|today)\b/.test(note)) startOffset = 0;

  const moves: RescheduleDraft['moves'] = [];
  let dayIndex = startOffset;
  for (const quest of overdue) {
    const mins = quest.estimated_minutes ?? 10;
    let placed = false;
    for (let attempt = 0; attempt < dayCount + 5; attempt += 1) {
      const candidate = addDays(today, Math.min(dayIndex + attempt, dayCount + 4));
      const used = load.get(candidate) ?? 0;
      if (used + mins <= budget) {
        load.set(candidate, used + mins);
        moves.push({
          quest_id: quest.id,
          title: quest.title,
          from_date: quest.due_date,
          to_date: candidate,
          estimated_minutes: quest.estimated_minutes,
        });
        dayIndex = Math.min(dayIndex + attempt + 1, dayCount);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const fallback = addDays(today, dayIndex);
      moves.push({
        quest_id: quest.id,
        title: quest.title,
        from_date: quest.due_date,
        to_date: fallback,
        estimated_minutes: quest.estimated_minutes,
      });
      dayIndex += 1;
    }
  }

  return {
    moves,
    mochi_message: "Let's adjust the plan together. Soft new dates — no rush, just a kinder path ♡",
  };
}

/** Clamp / repair a model draft so every overdue quest is moved exactly once. */
export function normalizeRescheduleDraft(
  raw: RescheduleDraft,
  overdue: Quest[],
  allQuests: Quest[],
  goal: MilestoneGoalSummary,
  milestone: Milestone,
  today: string,
): RescheduleDraft {
  const byId = new Map(overdue.map((q) => [q.id, q]));
  const seen = new Set<number>();
  const moves: RescheduleDraft['moves'] = [];

  for (const move of raw.moves) {
    const quest = byId.get(move.quest_id);
    if (!quest || seen.has(move.quest_id)) continue;
    const to =
      IsoDateSchema.safeParse(move.to_date).success && move.to_date >= today
        ? move.to_date
        : today;
    seen.add(quest.id);
    moves.push({
      quest_id: quest.id,
      title: quest.title,
      from_date: quest.due_date,
      to_date: to,
      estimated_minutes: quest.estimated_minutes,
    });
  }

  // Ensure every overdue quest appears exactly once.
  for (const quest of overdue) {
    if (seen.has(quest.id)) continue;
    moves.push({
      quest_id: quest.id,
      title: quest.title,
      from_date: quest.due_date,
      to_date: today,
      estimated_minutes: quest.estimated_minutes,
    });
  }

  if (moves.length === 0) {
    return buildEchoReschedule(goal, milestone, overdue, allQuests, today);
  }

  const message =
    raw.mochi_message.trim().length > 0 && !raw.mochi_message.includes('?')
      ? raw.mochi_message.trim()
      : "Let's adjust the plan together.";

  return { moves, mochi_message: message };
}

/** First day whose proposed load exceeds the daily budget, or null. */
export function findRescheduleBudgetOverflow(
  draft: RescheduleDraft,
  allQuests: Quest[],
  dailyBudget: number,
): string | null {
  const movedIds = new Set(draft.moves.map((m) => m.quest_id));
  const load = buildFixedDayLoad(allQuests, movedIds);
  for (const move of draft.moves) {
    const mins = move.estimated_minutes ?? 10;
    load.set(move.to_date, (load.get(move.to_date) ?? 0) + mins);
  }
  for (const [day, total] of [...load.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (total > dailyBudget) return day;
  }
  return null;
}
