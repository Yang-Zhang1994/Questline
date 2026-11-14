import { z } from 'zod';
import { InterviewStateSchema } from './interview.js';

export const ChatRoleSchema = z.enum(['user', 'mochi']);

export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatMessageSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  goal_id: z.number().int().positive().nullable(),
  role: ChatRoleSchema,
  content: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatHistoryResponseSchema = z.object({
  messages: z.array(ChatMessageSchema),
  interview: InterviewStateSchema,
});

export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponseSchema>;

/** Client POST body — one user turn. */
export const SendChatMessageBodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message is too long (max 2000 characters)'),
});

export type SendChatMessageBody = z.infer<typeof SendChatMessageBodySchema>;

export const SendChatMessageResponseSchema = z.object({
  user_message: ChatMessageSchema,
  mochi_message: ChatMessageSchema,
  interview: InterviewStateSchema,
});

export type SendChatMessageResponse = z.infer<typeof SendChatMessageResponseSchema>;

/** Restart clears chat + interview and re-seeds the welcome turn. */
export const RestartInterviewResponseSchema = ChatHistoryResponseSchema;

export type RestartInterviewResponse = z.infer<typeof RestartInterviewResponseSchema>;
