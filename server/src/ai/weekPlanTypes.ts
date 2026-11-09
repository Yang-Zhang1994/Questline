import {
  WeekPlanDraftSchema,
  type Milestone,
  type MilestoneGoalSummary,
  type Quest,
  type WeekPlanDraft,
} from '@questline/shared';
import type { ClaudeChatTurn } from './client.js';

export { WeekPlanDraftSchema };
export type { WeekPlanDraft };

export type ProposeWeekPlanRequest = {
  goal: MilestoneGoalSummary;
  milestone: Milestone;
  /** Existing quests on the current milestone (scheduled + completed). */
  existingQuests: Quest[];
  /** Local YYYY-MM-DD "today". */
  today: string;
  weekStart: string;
  weekEnd: string;
  history?: ClaudeChatTurn[];
};

export type ReviseWeekPlanRequest = {
  goal: MilestoneGoalSummary;
  milestone: Milestone;
  existingQuests: Quest[];
  previous: WeekPlanDraft;
  feedback?: string;
  today: string;
  weekStart: string;
  weekEnd: string;
  history?: ClaudeChatTurn[];
};
