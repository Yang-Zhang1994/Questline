import type { InterviewTopic } from '@questline/shared';
import { INTERVIEW_TOPICS } from '@questline/shared';

/** Soft interview system prompt (Issue #3). Claude must reply with JSON only. */
export const MOCHI_INTERVIEW_SYSTEM_PROMPT = `You are Mochi, a warm, cozy AI guide in Questline (a life-sim quest diary).

You are running a structured goal interview. Voice rules:
- Warm, short, encouraging — never guilt-tripping.
- Ask exactly ONE question in mochi_message when the interview continues (one "?" only).
- Keep mochi_message to a few short sentences (roughly under 80 words).
- Prefer concrete, kind language. Emoji sparingly is fine (♡ ✦ ✨).

You MUST respond with a single JSON object and nothing else:
{
  "evaluation": "accepted" | "vague",
  "extracted_answer": string | null,
  "mochi_message": string
}

Rules for evaluation:
- "accepted" if the user's answer clearly covers the current_topic.
- "vague" if the answer is fuzzy, one-word, off-topic, or missing the topic — then ask a follow-up about the SAME current_topic.
- When evaluation is "accepted", set extracted_answer to a short cleaned version of what they said.
- When evaluation is "vague", set extracted_answer to null and put the follow-up question in mochi_message.
- When evaluation is "accepted" and next_topic is provided, mochi_message should briefly acknowledge, then ask exactly one question about next_topic.
- When evaluation is "accepted" and next_topic is null (interview finished), mochi_message should warmly summarize the four answers and say a goal draft/confirm step comes next — do NOT ask a new question and do NOT invent milestones.

Never ask about more than one topic in a single mochi_message. Never guilt-trip.`;

export const TOPIC_LABELS: Record<InterviewTopic, string> = {
  done_definition: 'what "done" looks like',
  starting_point: 'starting point',
  time_budget: 'available time per day/week',
  deadline: 'deadline',
};

/** Deterministic single-question templates (fallback + echo client). */
export const TOPIC_QUESTIONS: Record<InterviewTopic, string> = {
  done_definition: 'What would "done" look like for this dream?',
  starting_point: 'Where are you starting from today — beginner, some practice, or already mid-way?',
  time_budget: 'How much time can you give this each day or week?',
  deadline: 'When would you love to reach "done"?',
};

export const TOPIC_FOLLOWUPS: Record<InterviewTopic, string> = {
  done_definition:
    'Could you paint a clearer picture of "done"? For example, "finish reading one Japanese novel without a dictionary."',
  starting_point:
    'Tell me a little more about your starting point — what can you already do, and what feels brand new?',
  time_budget:
    'How many minutes a day (or hours a week) feels realistic for you right now?',
  deadline: 'What date or timeframe feels like a kind, doable deadline?',
};

export const INTERVIEW_COMPLETE_STUB =
  "Lovely — I've got a clear picture of done, where you're starting, your time budget, and your deadline. Next I'll draft a concrete goal for you to confirm before anything is saved ♡";

export { INTERVIEW_TOPICS };

export function nextTopicAfter(topic: InterviewTopic): InterviewTopic | null {
  const index = INTERVIEW_TOPICS.indexOf(topic);
  if (index < 0 || index >= INTERVIEW_TOPICS.length - 1) return null;
  return INTERVIEW_TOPICS[index + 1] ?? null;
}

export function questionForTopic(topic: InterviewTopic): string {
  return TOPIC_QUESTIONS[topic];
}

export function followUpForTopic(topic: InterviewTopic): string {
  return TOPIC_FOLLOWUPS[topic];
}

export function buildAcceptedReply(
  topic: InterviewTopic,
  next: InterviewTopic | null,
  extracted: string,
): string {
  if (!next) {
    return `${INTERVIEW_COMPLETE_STUB} (Captured for ${TOPIC_LABELS[topic]}: ${extracted})`;
  }
  return `Got it — ${extracted}. ${questionForTopic(next)}`;
}
