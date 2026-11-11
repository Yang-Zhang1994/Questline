import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage, InterviewState } from '@questline/shared';
import { fetchChatMessages, restartInterview, sendChatMessage } from '../api/chat';

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

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchChatMessages();
      setMessages(payload.messages);
      setInterview(payload.interview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const send = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setSending(true);
    setError(null);
    try {
      const payload = await sendChatMessage(trimmed);
      setMessages((prev) => [...prev, payload.user_message, payload.mochi_message]);
      setInterview(payload.interview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  }, []);

  const restart = useCallback(async () => {
    setRestarting(true);
    setError(null);
    try {
      const payload = await restartInterview();
      setMessages(payload.messages);
      setInterview(payload.interview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restart the interview');
    } finally {
      setRestarting(false);
    }
  }, []);

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
    send,
    restart,
    reload,
    appendMessages,
  };
}
