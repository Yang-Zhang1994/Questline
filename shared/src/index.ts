/** Shared types and zod schemas for Questline. */
export const APP_NAME = 'Questline' as const;

export {
  AuthResponseSchema,
  EmailSchema,
  LoginBodySchema,
  PasswordSchema,
  PublicUserSchema,
  RegisterBodySchema,
  type AuthResponse,
  type LoginBody,
  type PublicUser,
  type RegisterBody,
} from './schemas/auth.js';

export {
  CurrentMilestoneQuestsResponseSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  ProposedQuestListSchema,
  ProposedQuestSchema,
  QUEST_GENERATION_WINDOW_DAYS,
  QuestGenerationAiResponseSchema,
  QuestSchema,
  TodayQuestsResponseSchema,
  ToggleQuestCompletionBodySchema,
  ToggleQuestCompletionResponseSchema,
  createQuestProposalListSchema,
  type CurrentMilestoneQuestsResponse,
  type ProposedQuest,
  type ProposedQuestList,
  type Quest,
  type QuestGenerationAiResponse,
  type QuestProposalValidationOptions,
  type TodayQuestsResponse,
  type ToggleQuestCompletionBody,
  type ToggleQuestCompletionResponse,
} from './schemas/quest.js';

export { UserProgressSchema, type UserProgress } from './schemas/progress.js';

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

export {
  ChatHistoryResponseSchema,
  ChatMessageSchema,
  ChatRoleSchema,
  RestartInterviewResponseSchema,
  SendChatMessageBodySchema,
  SendChatMessageResponseSchema,
  type ChatHistoryResponse,
  type ChatMessage,
  type ChatRole,
  type RestartInterviewResponse,
  type SendChatMessageBody,
  type SendChatMessageResponse,
} from './schemas/chat.js';

export {
  INTERVIEW_TOPICS,
  InterviewAnswersSchema,
  InterviewStateSchema,
  InterviewStatusSchema,
  InterviewTopicSchema,
  type InterviewAnswers,
  type InterviewState,
  type InterviewStatus,
  type InterviewTopic,
} from './schemas/interview.js';

export {
  ConfirmGoalBodySchema,
  ConfirmGoalResponseSchema,
  GoalDraftResponseSchema,
  GoalDraftSchema,
  GoalSchema,
  ReviseGoalDraftBodySchema,
  type ConfirmGoalBody,
  type ConfirmGoalResponse,
  type Goal,
  type GoalDraft,
  type GoalDraftResponse,
  type ReviseGoalDraftBody,
} from './schemas/goal.js';

export {
  ConfirmMilestonesBodySchema,
  ConfirmMilestonesResponseSchema,
  MAX_MILESTONES,
  MIN_MILESTONES,
  MilestoneGoalSchema,
  MilestonePlanAiResponseSchema,
  MilestonePlanStateResponseSchema,
  ProposeMilestonesBodySchema,
  ProposeMilestonesResponseSchema,
  ProposedMilestoneListSchema,
  ProposedMilestoneSchema,
  createMilestoneProposalListSchema,
  extractGoalDeadlineDate,
  resolveGoalDeadlineDate,
  type ConfirmMilestonesBody,
  type ConfirmMilestonesResponse,
  type MilestonePlanAiResponse,
  type MilestonePlanStateResponse,
  type ProposeMilestonesBody,
  type ProposeMilestonesResponse,
  type ProposedMilestone,
  type ProposedMilestoneList,
} from './schemas/milestonePlan.js';
