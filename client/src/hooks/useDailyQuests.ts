import { useCallback, useEffect, useState } from 'react';
import type { TodayQuestsResponse } from '@questline/shared';
import { fetchTodayQuests, setQuestCompletion } from '../api/quests';

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useDailyQuests() {
  const [data, setData] = useState<TodayQuestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyQuestId, setBusyQuestId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchTodayQuests(todayLocalDate());
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleQuest = useCallback(async (questId: number, completed: boolean) => {
    setBusyQuestId(questId);
    setError(null);
    try {
      const quest = await setQuestCompletion(questId, completed);
      setData((prev) => {
        if (!prev) return prev;
        const quests = prev.quests.map((q) => (q.id === quest.id ? quest : q));
        const doneCount = quests.filter((q) => q.completed_at !== null).length;
        return {
          ...prev,
          quests,
          done_count: doneCount,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update quest');
    } finally {
      setBusyQuestId(null);
    }
  }, []);

  return {
    data,
    loading,
    error,
    busyQuestId,
    toggleQuest,
    reload,
  };
}
