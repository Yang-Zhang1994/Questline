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
  StageReadySummarySchema,
  TodayQuestsResponseSchema,
  ToggleQuestCompletionBodySchema,
  ToggleQuestCompletionResponseSchema,
  calendarDayDiff,
  createQuestProposalListSchema,
  isLocalDateWithinOneDay,
  isRealCalendarDate,
  type CurrentMilestoneQuestsResponse,
  type ProposedQuest,
  type ProposedQuestList,
  type Quest,
  type QuestGenerationAiResponse,
  type QuestProposalValidationOptions,
  type StageReadySummary,
  type TodayQuestsResponse,
  type ToggleQuestCompletionBody,
  type ToggleQuestCompletionResponse,
} from './schemas/quest.js';

export {
  DiaryNoteContentSchema,
  DiaryNoteSchema,
  MAX_DIARY_NOTE_LENGTH,
  UpsertDiaryNoteBodySchema,
  type DiaryNote,
  type UpsertDiaryNoteBody,
} from './schemas/diary.js';

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
  ActivateGoalResponseSchema,
  ConfirmGoalBodySchema,
  ConfirmGoalResponseSchema,
  DeleteGoalResponseSchema,
  GoalDraftResponseSchema,
  GoalDraftSchema,
  GoalSchema,
  GoalsListResponseSchema,
  ReviseGoalDraftBodySchema,
  StartNewGoalResponseSchema,
  type ActivateGoalResponse,
  type ConfirmGoalBody,
  type ConfirmGoalResponse,
  type DeleteGoalResponse,
  type Goal,
  type GoalDraft,
  type GoalDraftResponse,
  type GoalsListResponse,
  type ReviseGoalDraftBody,
  type StartNewGoalResponse,
} from './schemas/goal.js';
export {
  CompleteStageResponseSchema,
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
  type CompleteStageResponse,
  type ConfirmMilestonesBody,
  type ConfirmMilestonesResponse,
  type MilestonePlanAiResponse,
  type MilestonePlanStateResponse,
  type ProposeMilestonesBody,
  type ProposeMilestonesResponse,
  type ProposedMilestone,
  type ProposedMilestoneList,
} from './schemas/milestonePlan.js';

export {
  ManualPlanBodySchema,
  ManualPlanResponseSchema,
  type ManualPlanBody,
  type ManualPlanResponse,
} from './schemas/manualPlan.js';
