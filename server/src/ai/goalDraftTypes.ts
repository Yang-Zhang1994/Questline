import { GoalDraftSchema, type GoalDraft, type InterviewAnswers } from '@questline/shared';
import type { ClaudeChatTurn } from './client.js';

export { GoalDraftSchema };
export type { GoalDraft };

export type ProposeGoalDraftRequest = {
  answers: InterviewAnswers;
  history?: ClaudeChatTurn[];
};

export type ReviseGoalDraftRequest = {
  answers: InterviewAnswers;
  previous: GoalDraft;
  feedback?: string;
  history?: ClaudeChatTurn[];
};
