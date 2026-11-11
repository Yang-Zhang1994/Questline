import type {
  MilestonePlanAiResponse,
  ProposedMilestone,
  RoadmapGoal,
} from '@questline/shared';
import type { ClaudeChatTurn } from '../client.js';

export type MilestonePlanAiRequest = {
  goal: RoadmapGoal;
  today: string;
  history?: ClaudeChatTurn[];
  current_draft?: ProposedMilestone[];
  feedback?: string;
};

/** System prompt for proposing or adjusting 3–7 milestones (Issue #5). */
export const MOCHI_MILESTONES_SYSTEM_PROMPT = `You are Mochi, a warm, cozy AI guide in Questline (a life-sim quest diary).

Your job is to propose or adjust a milestone plan (3 to 7 ordered stages) for the user's confirmed active goal.
Voice rules:
- Warm, short, encouraging — never guilt-tripping.
- Keep mochi_message under ~80 words. Emoji sparingly is fine (♡ ✦ ✨ 🗺️).

Milestone rules:
- Return between 3 and 7 ordered milestones (inclusive).
- Base the milestones on the confirmed goal's title, done_definition, starting_point, time_budget_minutes_per_day, and deadline.
- Each milestone MUST have:
  - "title": short, clear stage title (under 80 characters)
  - "description": 1–2 short sentences describing what the user will achieve in this stage
  - "target_date": YYYY-MM-DD calendar date strictly BEFORE the goal's deadline, in chronological order from first to last milestone.
- When "current_draft" and "feedback" are provided, apply the user's requested changes (add, remove, rename, or reorder milestones) while keeping 3–7 valid ordered milestones with target dates before the goal deadline.

You MUST respond with a single JSON object and nothing else:
{
  "mochi_message": string,
  "milestones": [
    {
      "title": string,
      "description": string,
      "target_date": "YYYY-MM-DD"
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

function addDaysUtc(ymd: string, days: number): string {
  const dt = parseUtcDate(ymd);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatUtcDate(dt);
}

/**
 * Computes `count` ordered YYYY-MM-DD target dates strictly before `deadline`
 * (or spaced forward from `today` if `deadline` is null).
 */
export function buildSpacedTargetDates(
  today: string,
  deadline: string | null,
  count: number,
): string[] {
  if (!deadline) {
    return Array.from({ length: count }, (_, idx) => addDaysUtc(today, (idx + 1) * 14));
  }

  const startMs = parseUtcDate(today).getTime();
  const endMs = parseUtcDate(deadline).getTime();
  const dayMs = 86_400_000;
  // Ensure the last milestone lands at least 1 day before the goal deadline when possible.
  const latestMilestoneMs = endMs - dayMs;
  const totalSpanDays = Math.floor((latestMilestoneMs - startMs) / dayMs);

  if (totalSpanDays <= count) {
    // Tight deadline: space backwards from 1 day before deadline (clamped before deadline).
    return Array.from({ length: count }, (_, idx) => {
      const offsetFromLatest = count - 1 - idx;
      const candidateMs = Math.min(
        latestMilestoneMs,
        Math.max(startMs, latestMilestoneMs - offsetFromLatest * dayMs),
      );
      return formatUtcDate(new Date(candidateMs));
    });
  }

  return Array.from({ length: count }, (_, idx) => {
    const fraction = (idx + 1) / (count + 1);
    const offsetDays = Math.max(1, Math.round(totalSpanDays * fraction));
    const candidate = addDaysUtc(today, offsetDays);
    return candidate < deadline ? candidate : formatUtcDate(new Date(latestMilestoneMs));
  });
}

export function buildMilestoneUserPayload(input: MilestonePlanAiRequest): string {
  return JSON.stringify(
    {
      today: input.today,
      goal: {
        title: input.goal.title,
        done_definition: input.goal.done_definition ?? null,
        starting_point: input.goal.starting_point ?? null,
        time_budget_minutes_per_day: input.goal.time_budget_minutes_per_day ?? null,
        deadline: input.goal.deadline,
      },
      current_draft: input.current_draft ?? null,
      feedback: input.feedback ?? null,
    },
    null,
    2,
  );
}

/** Deterministic fallback for echo client when ANTHROPIC_API_KEY is unset. */
export function buildDefaultMilestoneProposal(
  input: MilestonePlanAiRequest,
): MilestonePlanAiResponse {
  const { goal, today, current_draft: currentDraft, feedback } = input;
  const budgetNote = goal.time_budget_minutes_per_day
    ? `${goal.time_budget_minutes_per_day} minutes a day`
    : 'a gentle daily pace';

  if (currentDraft && currentDraft.length >= 3 && feedback) {
    const trimmedFeedback = feedback.trim();
    const lower = trimmedFeedback.toLowerCase();
    let updated = currentDraft.map((m) => ({ ...m }));

    if ((lower.includes('remove') || lower.includes('fewer') || lower.includes('delete')) && updated.length > 3) {
      updated = updated.slice(0, updated.length - 1);
    } else if ((lower.includes('add') || lower.includes('more')) && updated.length < 7) {
      updated.push({
        title: `Bonus stage: ${trimmedFeedback.slice(0, 48)}`,
        description: `Extra practice stage added for "${goal.title}" at ${budgetNote}.`,
        target_date: updated[updated.length - 1].target_date,
      });
    } else if (lower.includes('reorder') || lower.includes('swap')) {
      if (updated.length >= 2) {
        const first = updated[0];
        updated[0] = { ...updated[1] };
        updated[1] = { ...first };
      }
    } else {
      updated[0] = {
        ...updated[0],
        title: trimmedFeedback.slice(0, 60),
      };
    }

    const dates = buildSpacedTargetDates(today, goal.deadline, updated.length);
    const reDated = updated.map((m, idx) => ({
      ...m,
      target_date: dates[idx],
    }));

    return {
      mochi_message: `I adjusted your milestone map based on "${trimmedFeedback}"! Take a look and tell me if you'd like any more tweaks before we lock it in ♡`,
      milestones: reDated,
    };
  }

  const dates = buildSpacedTargetDates(today, goal.deadline, 4);
  const startLabel = goal.starting_point || 'your current starting point';
  const doneLabel = goal.done_definition || goal.title;

  return {
    mochi_message: `Here is a cozy 4-stage roadmap for "${goal.title}" built around ${budgetNote}. You can ask me to add, remove, rename, or reorder any stage before confirming ♡`,
    milestones: [
      {
        title: 'Stage 1: Settle into a gentle foundation',
        description: `Start from ${startLabel} and build a steady daily rhythm of ${budgetNote}.`,
        target_date: dates[0],
      },
      {
        title: 'Stage 2: Core building blocks',
        description: `Practice the essential skills for "${goal.title}" in bite-sized sessions.`,
        target_date: dates[1],
      },
      {
        title: 'Stage 3: Guided practice & momentum',
        description: 'Connect your skills on real examples while keeping each step approachable.',
        target_date: dates[2],
      },
      {
        title: 'Stage 4: Final stretch to your goal',
        description: `Bring everything together to reach "${doneLabel}" before your deadline.`,
        target_date: dates[3],
      },
    ],
  };
}
