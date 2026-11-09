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
  GoalStatusSchema,
  ReviseGoalDraftBodySchema,
  type ConfirmGoalBody,
  type ConfirmGoalResponse,
  type Goal,
  type GoalDraft,
  type GoalDraftResponse,
  type GoalStatus,
  type ReviseGoalDraftBody,
} from './schemas/goal.js';
