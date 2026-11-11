import type { InterviewAnswers } from '@questline/shared';
import type { GoalDraft } from '@questline/shared';

/**
 * System prompt for proposing / revising a measurable Goal from interview answers.
 * JSON only — never invent milestones or quests (those are #5+).
 */
export const MOCHI_GOAL_DRAFT_SYSTEM_PROMPT = `You are Mochi, a warm cozy guide in Questline (a life-sim quest diary).

The user finished a four-topic interview (done definition, starting point, time budget, deadline).
Your job: turn their answers into ONE concrete, measurable Goal with a deadline.

Reply with ONLY a JSON object (no markdown fences) matching:
{
  "title": string,                       // specific measurable goal statement
  "done_definition": string,             // what "done" looks like
  "starting_point": string,              // where they are now
  "time_budget_minutes_per_day": number, // positive integer minutes per day
  "deadline": string,                    // prefer YYYY-MM-DD when possible, else short phrase
  "mochi_message": string                // short warm note, NO question marks
}

Rules:
- Base every field on the interview answers — do not invent a different dream.
- title must be specific and measurable (not vague like "get better at Japanese").
- time_budget_minutes_per_day must be a positive integer parsed from their time answer.
- Warm, short Mochi voice — never guilt-tripping.
- Do NOT invent milestones, quests, or a roadmap.
- Do NOT ask questions (no "?" in mochi_message).
- When revising, keep what still fits and adjust from the user's feedback.`;

/** Heuristic: pull a daily minutes number from free-text time budget answers. */
export function parseTimeBudgetMinutes(raw: string | null | undefined): number {
  if (!raw) return 20;
  const text = raw.toLowerCase();
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    if (Number.isFinite(hours) && hours > 0) {
      return Math.max(1, Math.round(hours * 60));
    }
  }
  const minMatch = text.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
  if (minMatch) {
    const mins = Number(minMatch[1]);
    if (Number.isFinite(mins) && mins > 0) return mins;
  }
  const bare = text.match(/\b(\d+)\b/);
  if (bare) {
    const n = Number(bare[1]);
    if (Number.isFinite(n) && n > 0 && n <= 240) return n;
  }
  return 20;
}

/** Soft local draft when Claude is unavailable — keeps demos working. */
export function buildEchoGoalDraft(answers: InterviewAnswers, feedback?: string): GoalDraft {
  const done = (answers.done_definition ?? 'reach my dream').trim();
  const start = (answers.starting_point ?? 'where I am today').trim();
  const deadline = (answers.deadline ?? 'within a year').trim();
  const minutes = parseTimeBudgetMinutes(answers.time_budget);

  const titleBase = done.replace(/\.$/, '');
  const title =
    /within|by |before |in \d|year|month|week|deadline/i.test(titleBase) &&
    /within|by |before |in \d|year|month|week/i.test(deadline) === false
      ? titleBase
      : `${titleBase} — deadline: ${deadline}`;

  const revisedNote = feedback?.trim()
    ? ` I tweaked it with your note: "${feedback.trim().slice(0, 80)}${feedback.trim().length > 80 ? '…' : ''}".`
    : '';

  return {
    title,
    done_definition: done,
    starting_point: start,
    time_budget_minutes_per_day: minutes,
    deadline,
    mochi_message: `Here's a concrete goal from what you shared.${revisedNote} Accept when it feels right, or ask me to revise ♡`,
  };
}
