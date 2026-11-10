/** Shared types and zod schemas for Questline. */
export const APP_NAME = 'Questline' as const;

export {
  IsoDateSchema,
  IsoDateTimeSchema,
  QuestSchema,
  TodayQuestsResponseSchema,
  ToggleQuestCompletionBodySchema,
  ToggleQuestCompletionResponseSchema,
  type Quest,
  type TodayQuestsResponse,
  type ToggleQuestCompletionBody,
  type ToggleQuestCompletionResponse,
} from './schemas/quest.js';

export {
  GoalStatusSchema,
  MilestoneSchema,
  MilestoneStatusSchema,
  RoadmapGoalSchema,
  RoadmapResponseSchema,
  type GoalStatus,
  type Milestone,
  type MilestoneStatus,
  type RoadmapGoal,
  type RoadmapResponse,
} from './schemas/roadmap.js';
