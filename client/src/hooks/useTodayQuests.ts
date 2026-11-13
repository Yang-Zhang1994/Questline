import { useCallback, useEffect, useState } from 'react';
import type { CurrentMilestoneQuestsResponse, Milestone, Quest, RoadmapGoal } from '@questline/shared';
import {
  FRIENDLY_QUESTS_ERROR,
  fetchCurrentMilestoneQuests,
  generateCurrentMilestoneQuests,
} from '../api/quests';

export type TodayViewStatus =
  | 'loading'
  | 'error'
  | 'no_goal'
  | 'no_milestones'
  | 'rest_day'
  | 'quests_today';

function toFriendlyErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return FRIENDLY_QUESTS_ERROR;
  const trimmed = err.message.trim();
  if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return FRIENDLY_QUESTS_ERROR;
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

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  const goal: RoadmapGoal | null = data?.goal ?? null;
  const milestone: Milestone | null = data?.milestone ?? null;
  const todayDate: string | null = data?.window_start ?? null;
  const todayQuests: Quest[] = data ? filterQuestsDueToday(data) : [];

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
    loading,
    error,
    reload,
  };
}
