import {
  MilestonePlanDraftSchema,
  type MilestoneGoalSummary,
  type MilestonePlanDraft,
} from '@questline/shared';
import type { ClaudeChatTurn } from './client.js';

export { MilestonePlanDraftSchema };
export type { MilestonePlanDraft };

export type ProposeMilestonePlanRequest = {
  goal: MilestoneGoalSummary;
  /** Local YYYY-MM-DD "today" for spacing target dates. */
  today: string;
  history?: ClaudeChatTurn[];
};

export type ReviseMilestonePlanRequest = {
  goal: MilestoneGoalSummary;
  previous: MilestonePlanDraft;
  feedback?: string;
  today: string;
  history?: ClaudeChatTurn[];
};
