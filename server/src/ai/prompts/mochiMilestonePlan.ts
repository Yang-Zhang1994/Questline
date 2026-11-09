import type { MilestoneGoalSummary, MilestonePlanDraft } from '@questline/shared';
import { IsoDateSchema } from '@questline/shared';

/**
 * System prompt for proposing / revising a 3–7 milestone plan for a confirmed goal.
 * JSON only — never invent daily quests (those are #7).
 */
export const MOCHI_MILESTONE_PLAN_SYSTEM_PROMPT = `You are Mochi, a warm cozy guide in Questline (a life-sim quest diary).

The user has a confirmed Goal. Your job: propose an ordered roadmap of 3–7 Milestones (stages)
that lead from their starting point to done, with target dates before the goal deadline.

Reply with ONLY a JSON object (no markdown fences) matching:
{
  "milestones": [
    {
      "position": number,          // 1-based order
      "title": string,             // short stage name
      "description": string,       // one short sentence
      "target_date": "YYYY-MM-DD"  // on or before the goal deadline
    }
  ],
  "mochi_message": string          // short warm note, NO question marks
}

Rules:
- Propose between 3 and 7 milestones (inclusive). Prefer 4–5 when unsure.
- Positions must be consecutive starting at 1 with no gaps.
- Every target_date must be YYYY-MM-DD and on or before the goal deadline when the deadline is a date.
- Space dates evenly from today toward the deadline; earlier stages sooner.
- Base titles/descriptions on the goal title, done definition, starting point, and time budget.
- Warm, short Mochi voice — never guilt-tripping.
- Do NOT invent daily quests.
- Do NOT ask questions (no "?" in mochi_message).
- When revising from feedback: add, remove, rename, or reorder as asked while staying within 3–7.`;

function parseDeadlineDate(deadline: string | null): string | null {
  if (!deadline) return null;
  const trimmed = deadline.trim();
  const iso = IsoDateSchema.safeParse(trimmed);
  if (iso.success) return iso.data;
  // Soft parse "by 2027-11-09" style phrases.
  const match = trimmed.match(/(\d{4}-\d{2}-\d{2})/);
  if (match) {
    const nested = IsoDateSchema.safeParse(match[1]);
    if (nested.success) return nested.data;
  }
  return null;
}

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

function clampIsoOnOrBefore(date: string, deadline: string | null): string {
  if (!deadline) return date;
  return date > deadline ? deadline : date;
}

type StageSeed = { title: string; description: string };

function stageSeeds(goal: MilestoneGoalSummary): StageSeed[] {
  const title = goal.title.trim() || 'my goal';
  const start = (goal.starting_point ?? 'where I am today').trim();
  const done = (goal.done_definition ?? title).trim();
  return [
    {
      title: 'Settle into a tiny habit',
      description: `Build a gentle daily rhythm from "${start}" without rushing.`,
    },
    {
      title: 'Grow comfort with the basics',
      description: 'Practice the core skills until they feel familiar and kind.',
    },
    {
      title: 'Stretch into real practice',
      description: 'Apply what you know to slightly bigger, still cozy challenges.',
    },
    {
      title: 'Polish toward done',
      description: `Close the gap toward "${done}" with steady, low-pressure focus.`,
    },
    {
      title: `Arrive at: ${title.length > 48 ? `${title.slice(0, 45)}…` : title}`,
      description: 'Celebrate finishing the goal and notice how far you have come.',
    },
  ];
}

/**
 * Soft local draft when Claude is unavailable — keeps demos/tests working.
 * Always returns 3–5 milestones with YYYY-MM-DD target dates.
 */
export function buildEchoMilestonePlan(
  goal: MilestoneGoalSummary,
  today: string,
  feedback?: string,
): MilestonePlanDraft {
  const deadline = parseDeadlineDate(goal.deadline);
  const end = deadline ?? addDays(today, 120);
  const span = Math.max(daysBetween(today, end), 21);
  const seeds = stageSeeds(goal);

  let count = 4;
  const note = feedback?.trim().toLowerCase() ?? '';
  if (/\b(add|more|extra|another)\b/.test(note)) count = 5;
  if (/\b(fewer|less|remove|drop|simpler)\b/.test(note)) count = 3;
  if (/\breorder|rename|swap\b/.test(note)) count = Math.min(5, Math.max(3, seeds.length - 1));
  count = Math.min(5, Math.max(3, count));

  const picked = seeds.slice(0, count);
  const milestones = picked.map((seed, index) => {
    const position = index + 1;
    const fraction = position / count;
    const offset = Math.max(1, Math.round(span * fraction));
    const target = clampIsoOnOrBefore(addDays(today, offset), deadline);
    let title = seed.title;
    let description = seed.description;
    if (feedback?.trim() && /\brename\b/i.test(feedback) && position === 1) {
      title = `Renamed: ${title}`;
    }
    if (feedback?.trim() && position === count) {
      description = `${description} (tweaked from your note)`;
    }
    return { position, title, description, target_date: target };
  });

  if (feedback?.trim() && /\breorder|swap\b/i.test(feedback) && milestones.length >= 2) {
    const a = milestones[0];
    const b = milestones[1];
    milestones[0] = { ...b, position: 1 };
    milestones[1] = { ...a, position: 2 };
  }

  const revisedNote = feedback?.trim()
    ? ` I adjusted the map with your note: "${feedback.trim().slice(0, 80)}${feedback.trim().length > 80 ? '…' : ''}".`
    : '';

  return {
    milestones,
    mochi_message: `Here is a cozy ${milestones.length}-stage map toward your goal.${revisedNote} Edit with me, then confirm when it feels right ♡`,
  };
}

/** Normalize AI output: renumber positions, clamp dates, keep 3–7 items. */
export function normalizeMilestonePlan(
  draft: MilestonePlanDraft,
  goal: MilestoneGoalSummary,
  today: string,
): MilestonePlanDraft {
  const deadline = parseDeadlineDate(goal.deadline);
  let items = [...draft.milestones].slice(0, 7);
  if (items.length < 3) {
    return buildEchoMilestonePlan(goal, today);
  }

  items = items
    .map((item, index) => {
      const parsedDate = IsoDateSchema.safeParse(item.target_date);
      const target_date = clampIsoOnOrBefore(
        parsedDate.success ? parsedDate.data : addDays(today, (index + 1) * 14),
        deadline,
      );
      return {
        position: index + 1,
        title: item.title.trim() || `Stage ${index + 1}`,
        description: item.description.trim() || 'A gentle step forward.',
        target_date,
      };
    })
    .sort((a, b) => a.target_date.localeCompare(b.target_date))
    .map((item, index) => ({ ...item, position: index + 1 }));

  const mochi = draft.mochi_message.replace(/\?/g, '.').trim() || 'Here is your milestone map ♡';

  return { milestones: items, mochi_message: mochi };
}
