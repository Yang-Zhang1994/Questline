import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CurrentMilestoneQuestsResponse,
  Milestone,
  Quest,
  RoadmapGoal,
  UserProgress,
} from '@questline/shared';
import {
  FRIENDLY_QUEST_TOGGLE_ERROR,
  FRIENDLY_QUESTS_ERROR,
  fetchCurrentMilestoneQuests,
  generateCurrentMilestoneQuests,
  toggleQuestCompletion,
} from '../api/quests';

export type TodayViewStatus =
  | 'loading'
  | 'error'
  | 'no_goal'
  | 'no_milestones'
  | 'rest_day'
  | 'quests_today';

function toFriendlyErrorMessage(err: unknown, fallback = FRIENDLY_QUESTS_ERROR): string {
  if (!(err instanceof Error)) return fallback;
  const trimmed = err.message.trim();
  if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return fallback;
  }
  return trimmed;
}

export function hasQuestsInCurrentWindow(payload: CurrentMilestoneQuestsResponse): boolean {
  return payload.quests.some(
    (quest) => quest.due_date >= payload.window_start && quest.due_date <= payload.window_end,
  );
}

export function filterQuestsDueToday(payload: CurrentMilestoneQuestsResponse): Quest[] {
  return payload.quests.filter((quest) => quest.due_date === payload.window_start);
}

export function useTodayQuests() {
  const [data, setData] = useState<CurrentMilestoneQuestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingQuestIds, setPendingQuestIds] = useState<ReadonlySet<number>>(() => new Set());
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);
  const pendingRef = useRef<Set<number>>(new Set());

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setToggleError(null);
    try {
      let payload = await fetchCurrentMilestoneQuests();
      if (payload.goal && payload.milestone && !hasQuestsInCurrentWindow(payload)) {
        payload = await generateCurrentMilestoneQuests();
      }
      setData(payload);
    } catch (err) {
      console.error("Could not load today's quests:", err);
      setError(toFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleQuest = useCallback(async (questId: number, completed: boolean) => {
    if (pendingRef.current.has(questId)) {
      return;
    }

    let previousCompletedAt: string | null | undefined;
    const optimisticCompletedAt = completed ? new Date().toISOString() : null;

    setData((prev) => {
      if (!prev) return prev;
      const target = prev.quests.find((q) => q.id === questId);
      if (!target) return prev;
      previousCompletedAt = target.completed_at;
      const updatedQuests = prev.quests.map((q) =>
        q.id === questId ? { ...q, completed_at: optimisticCompletedAt } : q,
      );
      return {
        ...prev,
        quests: updatedQuests,
      };
    });

    pendingRef.current.add(questId);
    setPendingQuestIds(new Set(pendingRef.current));
    setToggleError(null);

    try {
      const result = await toggleQuestCompletion(questId, completed);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          progress: result.progress,
          quests: prev.quests.map((q) => (q.id === questId ? result.quest : q)),
        };
      });
      if (result.leveled_up && result.level_up_message) {
        setLevelUpMessage(result.level_up_message);
      }
    } catch (err) {
      console.error('Could not toggle quest completion:', err);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          quests: prev.quests.map((q) =>
            q.id === questId
              ? { ...q, completed_at: previousCompletedAt ?? null }
              : q,
          ),
        };
      });
      setToggleError(toFriendlyErrorMessage(err, FRIENDLY_QUEST_TOGGLE_ERROR));
    } finally {
      pendingRef.current.delete(questId);
      setPendingQuestIds(new Set(pendingRef.current));
    }
  }, []);

  const goal: RoadmapGoal | null = data?.goal ?? null;
  const milestone: Milestone | null = data?.milestone ?? null;
  const todayDate: string | null = data?.window_start ?? null;
  const todayQuests: Quest[] = data ? filterQuestsDueToday(data) : [];
  const progress: UserProgress | null = data?.progress ?? null;

  let status: TodayViewStatus;
  if (loading) {
    status = 'loading';
  } else if (error || !data) {
    status = 'error';
  } else if (!data.goal) {
    status = 'no_goal';
  } else if (!data.milestone) {
    status = 'no_milestones';
  } else if (todayQuests.length === 0) {
    status = 'rest_day';
  } else {
    status = 'quests_today';
  }

  return {
    status,
    goal,
    milestone,
    todayDate,
    todayQuests,
    progress,
    levelUpMessage,
    dismissLevelUp: () => setLevelUpMessage(null),
    loading,
    error,
    pendingQuestIds,
    toggleError,
    toggleQuest,
    reload,
  };
}
