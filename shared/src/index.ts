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
  ChatHistoryResponseSchema,
  ChatMessageSchema,
  ChatRoleSchema,
  SendChatMessageBodySchema,
  SendChatMessageResponseSchema,
  type ChatHistoryResponse,
  type ChatMessage,
  type ChatRole,
  type SendChatMessageBody,
  type SendChatMessageResponse,
} from './schemas/chat.js';
