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
  UserProgressSchema,
  type UserProgress,
} from './schemas/progress.js';

export {
  StampCardSchema,
  StampPastCardSchema,
  type StampCard,
  type StampPastCard,
} from './schemas/stamp.js';

export {
  IsoDateSchema,
  IsoDateTimeSchema,
  QuestDraftItemSchema,
  QuestPlanDraftSchema,
  QuestSchema,
  StageReadySummarySchema,
  TodayQuestsResponseSchema,
  ToggleQuestCompletionBodySchema,
  ToggleQuestCompletionResponseSchema,
  type Quest,
  type QuestDraftItem,
  type QuestPlanDraft,
  type StageReadySummary,
  type TodayQuestsResponse,
  type ToggleQuestCompletionBody,
  type ToggleQuestCompletionResponse,
} from './schemas/quest.js';
export {
  ConfirmQuestPlanBodySchema,
  ConfirmQuestPlanResponseSchema,
  QuestPlanResponseSchema,
  ReviseQuestPlanBodySchema,
  type ConfirmQuestPlanBody,
  type ConfirmQuestPlanResponse,
  type QuestPlanResponse,
  type ReviseQuestPlanBody,
} from './schemas/questPlan.js';

export {
  ConfirmRescheduleBodySchema,
  ConfirmRescheduleResponseSchema,
  RescheduleDraftSchema,
  RescheduleMoveSchema,
  RescheduleResponseSchema,
  ReviseRescheduleBodySchema,
  type ConfirmRescheduleBody,
  type ConfirmRescheduleResponse,
  type RescheduleDraft,
  type RescheduleMove,
  type RescheduleResponse,
  type ReviseRescheduleBody,
} from './schemas/reschedule.js';

export {
  ConfirmWeekPlanBodySchema,
  ConfirmWeekPlanResponseSchema,
  ReviseWeekPlanBodySchema,
  WeekPlanDraftSchema,
  WeekPlanResponseSchema,
  type ConfirmWeekPlanBody,
  type ConfirmWeekPlanResponse,
  type ReviseWeekPlanBody,
  type WeekPlanDraft,
  type WeekPlanResponse,
} from './schemas/weekPlan.js';

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
  ActivateGoalResponseSchema,
  DeleteGoalResponseSchema,
  GoalSchema,
  GoalStatusSchema,
  GoalsListResponseSchema,
  StartNewGoalResponseSchema,
  type ActivateGoalResponse,
  type DeleteGoalResponse,
  type Goal,
  type GoalStatus,
  type GoalsListResponse,
  type StartNewGoalResponse,
} from './schemas/goal.js';

export {
  DIARY_NOTE_MAX_LENGTH,
  DiaryNoteResponseSchema,
  DiaryNoteSchema,
  UpsertDiaryNoteBodySchema,
  type DiaryNote,
  type DiaryNoteResponse,
  type UpsertDiaryNoteBody,
} from './schemas/diaryNote.js';

export {
  CompleteStageResponseSchema,
  ConfirmMilestonePlanBodySchema,
  ConfirmMilestonePlanResponseSchema,
  MilestoneDraftItemSchema,
  MilestoneGoalSummarySchema,
  MilestonePlanDraftSchema,
  MilestonePlanResponseSchema,
  MilestoneSchema,
  MilestoneStatusSchema,
  ReviseMilestonePlanBodySchema,
  type CompleteStageResponse,
  type ConfirmMilestonePlanBody,
  type ConfirmMilestonePlanResponse,
  type Milestone,
  type MilestoneDraftItem,
  type MilestoneGoalSummary,
  type MilestonePlanDraft,
  type MilestonePlanResponse,
  type MilestoneStatus,
  type ReviseMilestonePlanBody,
} from './schemas/milestone.js';
