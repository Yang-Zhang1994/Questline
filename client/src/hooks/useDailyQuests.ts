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
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);
  const [stampRewardMessage, setStampRewardMessage] = useState<string | null>(null);

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
      const result = await setQuestCompletion(questId, completed, todayLocalDate());
      setData((prev) => {
        if (!prev) return prev;
        const inToday = prev.quests.some((q) => q.id === result.quest.id);
        const quests = inToday
          ? prev.quests.map((q) => (q.id === result.quest.id ? result.quest : q))
          : prev.quests;
        const overdue_quests = prev.overdue_quests
          .map((q) => (q.id === result.quest.id ? result.quest : q))
          .filter((q) => q.completed_at === null);
        const doneCount = quests.filter((q) => q.completed_at !== null).length;
        return {
          ...prev,
          quests,
          overdue_quests,
          done_count: doneCount,
          progress: result.progress,
          stamp_card: result.stamp_card,
          stage_ready: result.stage_ready,
          stage_ready_milestone: result.stage_ready_milestone,
        };
      });
      if (result.leveled_up && result.level_up_message) {
        setLevelUpMessage(result.level_up_message);
      }
      if (result.card_completed && result.card_reward_message) {
        setStampRewardMessage(result.card_reward_message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update quest');
    } finally {
      setBusyQuestId(null);
    }
  }, []);

  const dismissLevelUp = useCallback(() => {
    setLevelUpMessage(null);
  }, []);

  const dismissStampReward = useCallback(() => {
    setStampRewardMessage(null);
  }, []);

  return {
    data,
    loading,
    error,
    busyQuestId,
    levelUpMessage,
    dismissLevelUp,
    stampRewardMessage,
    dismissStampReward,
    toggleQuest,
    reload,
  };
}
