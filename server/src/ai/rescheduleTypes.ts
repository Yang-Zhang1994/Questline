import {
  RescheduleDraftSchema,
  type Milestone,
  type MilestoneGoalSummary,
  type Quest,
  type RescheduleDraft,
} from '@questline/shared';
import type { ClaudeChatTurn } from './client.js';

export { RescheduleDraftSchema };
export type { RescheduleDraft };

export type ProposeRescheduleRequest = {
  goal: MilestoneGoalSummary;
  milestone: Milestone;
  overdue: Quest[];
  /** All incomplete/complete quests on the active goal (for day-load). */
  allQuests: Quest[];
  /** Local YYYY-MM-DD "today". */
  today: string;
  history?: ClaudeChatTurn[];
};

export type ReviseRescheduleRequest = {
  goal: MilestoneGoalSummary;
  milestone: Milestone;
  overdue: Quest[];
  allQuests: Quest[];
  previous: RescheduleDraft;
  feedback?: string;
  today: string;
  history?: ClaudeChatTurn[];
};
