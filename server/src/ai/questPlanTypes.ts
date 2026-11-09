import {
  QuestPlanDraftSchema,
  type Milestone,
  type MilestoneGoalSummary,
  type QuestPlanDraft,
} from '@questline/shared';
import type { ClaudeChatTurn } from './client.js';

export { QuestPlanDraftSchema };
export type { QuestPlanDraft };

export type ProposeQuestPlanRequest = {
  goal: MilestoneGoalSummary;
  milestone: Milestone;
  /** Local YYYY-MM-DD "today" for spacing due dates. */
  today: string;
  history?: ClaudeChatTurn[];
};

export type ReviseQuestPlanRequest = {
  goal: MilestoneGoalSummary;
  milestone: Milestone;
  previous: QuestPlanDraft;
  feedback?: string;
  today: string;
  history?: ClaudeChatTurn[];
};
