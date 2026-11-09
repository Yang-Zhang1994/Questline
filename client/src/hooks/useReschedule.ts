import { useCallback, useEffect, useState } from 'react';
import type {
  Milestone,
  MilestoneGoalSummary,
  Quest,
  RescheduleDraft,
} from '@questline/shared';
import {
  confirmReschedule,
  fetchReschedule,
  proposeReschedule,
  reviseReschedule,
} from '../api/reschedule';

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type UseRescheduleOptions = {
  enabled?: boolean;
  localDate?: string;
};

/**
 * Loads / proposes a reschedule draft for overdue quests.
 * Confirm is the only path that rewrites due dates (Issue #14).
 */
export function useReschedule(options: UseRescheduleOptions = {}) {
  const { enabled = true, localDate } = options;
  const date = localDate ?? todayLocalDate();
  const [draft, setDraft] = useState<RescheduleDraft | null>(null);
  const [overdue, setOverdue] = useState<Quest[]>([]);
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
      const existing = await fetchReschedule(date);
      setDraft(existing.draft);
      setOverdue(existing.overdue);
      setGoal(existing.goal);
      setMilestone(existing.milestone);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load reschedule';
      if (/confirm a goal|not found/i.test(message)) {
        setDraft(null);
        setOverdue([]);
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
      const proposed = await proposeReschedule(date);
      setDraft(proposed.draft);
      setOverdue(proposed.overdue);
      setGoal(proposed.goal);
      setMilestone(proposed.milestone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draft a reschedule');
    } finally {
      setBusy(false);
    }
  }, [date]);

  const revise = useCallback(
    async (feedback?: string) => {
      setBusy(true);
      setError(null);
      try {
        const result = await reviseReschedule(feedback, date);
        setDraft(result.draft);
        setOverdue(result.overdue);
        setGoal(result.goal);
        setMilestone(result.milestone);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not revise the reschedule');
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
      const result = await confirmReschedule(draft, date);
      setDraft(null);
      setOverdue([]);
      setGoal(result.goal);
      setMilestone(result.milestone);
      setAppliedMessage(result.mochi_message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the reschedule');
    } finally {
      setBusy(false);
    }
  }, [draft, date]);

  return {
    draft,
    overdue,
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
