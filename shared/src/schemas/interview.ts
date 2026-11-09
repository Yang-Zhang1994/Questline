import { z } from 'zod';

/** The four interview topics from Issue #3 / US1. */
export const INTERVIEW_TOPICS = [
  'done_definition',
  'starting_point',
  'time_budget',
  'deadline',
] as const;

export const InterviewTopicSchema = z.enum(INTERVIEW_TOPICS);

export type InterviewTopic = z.infer<typeof InterviewTopicSchema>;

export const InterviewStatusSchema = z.enum(['in_progress', 'complete']);

export type InterviewStatus = z.infer<typeof InterviewStatusSchema>;

export const InterviewAnswersSchema = z.object({
  done_definition: z.string().nullable(),
  starting_point: z.string().nullable(),
  time_budget: z.string().nullable(),
  deadline: z.string().nullable(),
});

export type InterviewAnswers = z.infer<typeof InterviewAnswersSchema>;

export const InterviewStateSchema = z.object({
  status: InterviewStatusSchema,
  /** Next topic to fill; null when the interview is complete. */
  current_topic: InterviewTopicSchema.nullable(),
  /** Topics that already have an accepted answer (order preserved). */
  answered_topics: z.array(InterviewTopicSchema),
  answers: InterviewAnswersSchema,
});

export type InterviewState = z.infer<typeof InterviewStateSchema>;
