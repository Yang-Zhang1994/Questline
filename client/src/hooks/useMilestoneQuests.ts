import { useCallback, useEffect, useState } from 'react';
import type { MilestoneQuestsResponse, Quest } from '@questline/shared';
import { createQuest, deleteQuest, fetchMilestoneQuests } from '../api/quests';

function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type UseMilestoneQuestsOptions = {
  milestoneId: number | null;
  localDate?: string;
};

/**
 * Load / add / delete quests for a Map milestone sheet (Issue #20).
 */
export function useMilestoneQuests(options: UseMilestoneQuestsOptions) {
  const { milestoneId, localDate } = options;
  const date = localDate ?? todayLocalDate();

  const [data, setData] = useState<MilestoneQuestsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (milestoneId == null) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchMilestoneQuests(milestoneId);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load milestone quests');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [milestoneId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addQuest = useCallback(
    async (title: string, dueDate: string): Promise<Quest | null> => {
      if (milestoneId == null) return null;
      setBusy(true);
      setError(null);
      try {
        const result = await createQuest({ milestoneId, title, dueDate });
        setData((prev) => {
          if (!prev) return prev;
          const quests = [...prev.quests, result.quest].sort((a, b) =>
            a.due_date === b.due_date ? a.id - b.id : a.due_date.localeCompare(b.due_date),
          );
          const done_count = quests.filter((q) => q.completed_at !== null).length;
          return { ...prev, quests, done_count, total_count: quests.length };
        });
        return result.quest;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not add quest');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [milestoneId],
  );

  const removeQuest = useCallback(
    async (questId: number): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await deleteQuest(questId, date);
        setData((prev) => {
          if (!prev) return prev;
          const quests = prev.quests.filter((q) => q.id !== questId);
          const done_count = quests.filter((q) => q.completed_at !== null).length;
          return { ...prev, quests, done_count, total_count: quests.length };
        });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete quest');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [date],
  );

  return {
    data,
    quests: data?.quests ?? [],
    loading,
    busy,
    error,
    localDate: date,
    reload: load,
    addQuest,
    removeQuest,
  };
}
