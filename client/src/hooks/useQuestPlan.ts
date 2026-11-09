import { useCallback, useEffect, useState } from 'react';
import type {
  Milestone,
  MilestoneGoalSummary,
  Quest,
  QuestPlanDraft,
} from '@questline/shared';
import {
  confirmQuestPlan,
  fetchQuestPlan,
  proposeQuestPlan,
  reviseQuestPlan,
} from '../api/questPlan';

export type UseQuestPlanOptions = {
  /** When false, skip auto-propose (e.g. until milestones are confirmed). */
  enabled?: boolean;
  /** Auto-propose a draft when the current milestone has no saved quests. */
  autoPropose?: boolean;
};

/**
 * Loads / proposes a quest draft for the current milestone.
 * Confirm is the only path that persists quests (Issue #7).
 */
export function useQuestPlan(options: UseQuestPlanOptions = {}) {
  const { enabled = true, autoPropose = true } = options;
  const [draft, setDraft] = useState<QuestPlanDraft | null>(null);
  const [goal, setGoal] = useState<MilestoneGoalSummary | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [savedQuests, setSavedQuests] = useState<Quest[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const existing = await fetchQuestPlan();
      setGoal(existing.goal);
      setMilestone(existing.milestone);
      setSavedQuests(existing.quests);
      setConfirmed(existing.confirmed);

      if (existing.draft) {
        setDraft(existing.draft);
        return;
      }

      // Current milestone with no saved quests yet → ask Mochi for a draft.
      if (autoPropose && existing.milestone && !existing.confirmed) {
        const proposed = await proposeQuestPlan();
        setDraft(proposed.draft);
        setGoal(proposed.goal);
        setMilestone(proposed.milestone);
        setSavedQuests(proposed.quests);
        setConfirmed(proposed.confirmed);
        return;
      }

      setDraft(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load quest plan';
      if (/confirm a milestone|not found/i.test(message)) {
        setDraft(null);
        setGoal(null);
        setMilestone(null);
        setConfirmed(false);
        setSavedQuests([]);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, autoPropose]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmQuestPlan(draft);
      setSavedQuests(result.quests);
      setGoal(result.goal);
      setMilestone(result.milestone);
      setDraft(null);
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the quest plan');
    } finally {
      setBusy(false);
    }
  }, [draft]);

  const revise = useCallback(async (feedback?: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await reviseQuestPlan(feedback);
      setDraft(result.draft);
      setGoal(result.goal);
      setMilestone(result.milestone);
      setConfirmed(result.confirmed);
      setSavedQuests(result.quests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revise the quest plan');
    } finally {
      setBusy(false);
    }
  }, []);

  const propose = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const proposed = await proposeQuestPlan();
      setDraft(proposed.draft);
      setGoal(proposed.goal);
      setMilestone(proposed.milestone);
      setSavedQuests(proposed.quests);
      setConfirmed(proposed.confirmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draft a quest plan');
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    draft,
    goal,
    milestone,
    savedQuests,
    confirmed,
    loading,
    busy,
    error,
    confirm,
    revise,
    propose,
    reload: load,
  };
}
