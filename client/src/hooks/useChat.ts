import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, InterviewState, SendChatMessageResponse } from '@questline/shared';
import { ApiError, isAiUnavailableError } from '../api/apiError';
import { fetchChatMessages, restartInterview, sendChatMessage } from '../api/chat';
import { useGoalDraft } from './useGoalDraft';

type FailedSend = {
  tempId: number;
  content: string;
};

function friendlySendError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error) {
    if (/failed to fetch|network/i.test(err.message)) {
      return "Mochi couldn't reach the server right now. Please try again.";
    }
    if (err.message) {
      return err.message;
    }
  }
  return "Mochi couldn't send that right now. Please try again.";
}

function reconcileMessages(
  prev: ChatMessage[],
  tempId: number,
  payload: SendChatMessageResponse,
): ChatMessage[] {
  const hasTemp = prev.some((m) => m.id === tempId);
  const withUser = hasTemp
    ? prev.map((m) => (m.id === tempId ? payload.user_message : m))
    : prev.some((m) => m.id === payload.user_message.id)
      ? prev
      : [...prev, payload.user_message];

  if (withUser.some((m) => m.id === payload.mochi_message.id)) {
    return withUser;
  }
  return [...withUser, payload.mochi_message];
}

const EMPTY_INTERVIEW: InterviewState = {
  status: 'in_progress',
  current_topic: 'done_definition',
  answered_topics: [],
  answers: {
    done_definition: null,
    starting_point: null,
    time_budget: null,
    deadline: null,
  },
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interview, setInterview] = useState<InterviewState>(EMPTY_INTERVIEW);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [failedSend, setFailedSend] = useState<FailedSend | null>(null);
  const sendingRef = useRef(false);
  const nextTempIdRef = useRef(-1);

  const goal = useGoalDraft({
    interviewComplete: interview.status === 'complete',
    onInterviewUpdated: setInterview,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAiUnavailable(false);
    setFailedSend(null);
    try {
      const payload = await fetchChatMessages();
      setMessages(payload.messages);
      setInterview(payload.interview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setAiUnavailable(isAiUnavailableError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const performSend = useCallback(async (tempId: number, content: string) => {
    sendingRef.current = true;
    setSending(true);
    setError(null);
    setAiUnavailable(false);
    setFailedSend(null);
    try {
      const payload = await sendChatMessage(content);
      setMessages((prev) => reconcileMessages(prev, tempId, payload));
      setInterview(payload.interview);
    } catch (err) {
      setError(friendlySendError(err));
      setAiUnavailable(isAiUnavailableError(err));
      setFailedSend({ tempId, content });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, []);

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || sendingRef.current) return;

      const tempId = nextTempIdRef.current;
      nextTempIdRef.current -= 1;
      const optimisticMessage: ChatMessage = {
        id: tempId,
        user_id: 0,
        goal_id: null,
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMessage]);
      await performSend(tempId, trimmed);
    },
    [performSend],
  );

  const retry = useCallback(async () => {
    if (!failedSend || sendingRef.current) return;
    await performSend(failedSend.tempId, failedSend.content);
  }, [failedSend, performSend]);

  const resetGoal = goal.reset;

  const restart = useCallback(async () => {
    setRestarting(true);
    setError(null);
    setAiUnavailable(false);
    setFailedSend(null);
    try {
      const payload = await restartInterview();
      setMessages(payload.messages);
      setInterview(payload.interview);
      resetGoal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restart the interview');
      setAiUnavailable(isAiUnavailableError(err));
    } finally {
      setRestarting(false);
    }
  }, [resetGoal]);

  const appendMessages = useCallback((added: ChatMessage[]) => {
    if (added.length === 0) return;
    setMessages((prev) => [...prev, ...added]);
  }, []);

  return {
    messages,
    interview,
    loading,
    sending,
    restarting,
    error,
    aiUnavailable,
    canRetry: failedSend !== null,
    send,
    retry,
    restart,
    reload,
    appendMessages,
    goalDraft: goal.draft,
    confirmedGoal: goal.confirmedGoal,
    goalLoading: goal.loading,
    goalBusy: goal.busy,
    goalError: goal.error,
    acceptGoal: goal.accept,
    reviseGoal: goal.revise,
    returnToInterview: goal.returnToInterview,
  };
}
