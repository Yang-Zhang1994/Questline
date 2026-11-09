import { useCallback, useEffect, useState } from 'react';
import type {
  Milestone,
  MilestoneGoalSummary,
  Quest,
  WeekPlanDraft,
} from '@questline/shared';
import {
  confirmWeekPlan,
  fetchWeekPlan,
  proposeWeekPlan,
  reviseWeekPlan,
} from '../api/weekPlan';

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type UseWeekPlanOptions = {
  enabled?: boolean;
  localDate?: string;
};

/**
 * Loads / proposes a week plan draft for the current milestone.
 * Confirm is the only path that INSERTs quest rows (Issue #15).
 */
export function useWeekPlan(options: UseWeekPlanOptions = {}) {
  const { enabled = true, localDate } = options;
  const date = localDate ?? todayLocalDate();
  const [draft, setDraft] = useState<WeekPlanDraft | null>(null);
  const [existingQuests, setExistingQuests] = useState<Quest[]>([]);
  const [goal, setGoal] = useState<MilestoneGoalSummary | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const existing = await fetchWeekPlan(date);
      setDraft(existing.draft);
      setExistingQuests(existing.existing_quests);
      setGoal(existing.goal);
      setMilestone(existing.milestone);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load week plan';
      if (/confirm a goal|not found/i.test(message)) {
        setDraft(null);
        setExistingQuests([]);
        setGoal(null);
        setMilestone(null);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const propose = useCallback(async () => {
    setBusy(true);
    setError(null);
    setAppliedMessage(null);
    try {
      const proposed = await proposeWeekPlan(date);
      setDraft(proposed.draft);
      setExistingQuests(proposed.existing_quests);
      setGoal(proposed.goal);
      setMilestone(proposed.milestone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draft a week plan');
    } finally {
      setBusy(false);
    }
  }, [date]);

  const revise = useCallback(
    async (feedback?: string) => {
      setBusy(true);
      setError(null);
      try {
        const result = await reviseWeekPlan(feedback, date);
        setDraft(result.draft);
        setExistingQuests(result.existing_quests);
        setGoal(result.goal);
        setMilestone(result.milestone);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not revise the week plan');
      } finally {
        setBusy(false);
      }
    },
    [date],
  );

  const confirm = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmWeekPlan(draft, date);
      setDraft(null);
      setGoal(result.goal);
      setMilestone(result.milestone);
      setAppliedMessage(result.mochi_message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the week plan');
    } finally {
      setBusy(false);
    }
  }, [draft, date]);

  return {
    draft,
    existingQuests,
    goal,
    milestone,
    loading,
    busy,
    error,
    appliedMessage,
    propose,
    revise,
    confirm,
    reload: load,
  };
}
