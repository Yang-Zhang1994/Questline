import {
  ChatHistoryResponseSchema,
  RestartInterviewResponseSchema,
  SendChatMessageResponseSchema,
  type ChatHistoryResponse,
  type ChatMessage,
  type InterviewState,
  type RestartInterviewResponse,
  type SendChatMessageResponse,
} from '@questline/shared';
import { throwApiError } from './apiError';
import { authHeaders } from './authToken';

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

export async function fetchChatMessages(): Promise<ChatHistoryResponse> {
  const res = await fetch('/api/chat/messages', {
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throwApiError(res, body, 'Could not load chat');
  }
  return ChatHistoryResponseSchema.parse(body);
}

export async function sendChatMessage(content: string): Promise<SendChatMessageResponse> {
  const res = await fetch('/api/chat/messages', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throwApiError(res, body, 'Could not send message');
  }
  return SendChatMessageResponseSchema.parse(body);
}

export async function restartInterview(): Promise<RestartInterviewResponse> {
  const res = await fetch('/api/chat/interview/restart', {
    method: 'POST',
    headers: authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throwApiError(res, body, 'Could not restart the interview');
  }
  return RestartInterviewResponseSchema.parse(body);
}

export type { ChatMessage, InterviewState };
