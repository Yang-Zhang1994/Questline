import { z } from 'zod';
import {
  InterviewAnswersSchema,
  InterviewTopicSchema,
  type InterviewAnswers,
  type InterviewTopic,
} from '@questline/shared';
import type { ClaudeChatTurn } from './client.js';

export const InterviewAiEvaluationSchema = z.enum(['accepted', 'vague']);

export const InterviewAiResponseSchema = z.object({
  evaluation: InterviewAiEvaluationSchema,
  extracted_answer: z.string().trim().min(1).nullable(),
  mochi_message: z.string().trim().min(1),
});

export type InterviewAiResponse = z.infer<typeof InterviewAiResponseSchema>;

export type InterviewAiRequest = {
  history: ClaudeChatTurn[];
  current_topic: InterviewTopic;
  answered: InterviewAnswers;
  user_answer: string;
  /** Topic Mochi should ask next if this answer is accepted; null = interview finished. */
  next_topic: InterviewTopic | null;
};

export { InterviewAnswersSchema, InterviewTopicSchema };
