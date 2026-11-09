import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '@questline/shared';
import { fetchChatMessages, sendChatMessage } from '../api/chat';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchChatMessages();
      setMessages(payload.messages);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  }, []);

  return {
    messages,
    loading,
    sending,
    error,
    send,
    reload,
  };
}
