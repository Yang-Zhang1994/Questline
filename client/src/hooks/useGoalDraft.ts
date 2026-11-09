import { useCallback, useEffect, useState } from 'react';
import type { Goal, GoalDraft, InterviewState } from '@questline/shared';
import {
  confirmGoalDraft,
  fetchGoalDraft,
  proposeGoalDraft,
  returnGoalDraftToInterview,
  reviseGoalDraft,
} from '../api/goals';

export type UseGoalDraftOptions = {
  /** When true, auto-load / propose a draft. */
  interviewComplete: boolean;
  onInterviewUpdated?: (interview: InterviewState) => void;
};

export function useGoalDraft({ interviewComplete, onInterviewUpdated }: UseGoalDraftOptions) {
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [confirmedGoal, setConfirmedGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!interviewComplete) {
      setDraft(null);
      setConfirmedGoal(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const existing = await fetchGoalDraft();
      if (existing.draft) {
        setDraft(existing.draft);
        setConfirmedGoal(null);
        return;
      }
      if (existing.goal && !existing.draft) {
        // May be a pre-seeded active goal — still propose a new draft after interview.
      }
      const proposed = await proposeGoalDraft();
      setDraft(proposed.draft);
      setConfirmedGoal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draft a goal');
    } finally {
      setLoading(false);
    }
  }, [interviewComplete]);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmGoalDraft(draft);
      setConfirmedGoal(result.goal);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the goal');
    } finally {
      setBusy(false);
    }
  }, [draft]);

  const revise = useCallback(async (feedback?: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await reviseGoalDraft(feedback);
      setDraft(result.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revise the goal');
    } finally {
      setBusy(false);
    }
  }, []);

  const returnToInterview = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await returnGoalDraftToInterview();
      setDraft(null);
      setConfirmedGoal(null);
      onInterviewUpdated?.(result.interview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not return to the interview');
    } finally {
      setBusy(false);
    }
  }, [onInterviewUpdated]);

  const reset = useCallback(() => {
    setDraft(null);
    setConfirmedGoal(null);
    setError(null);
    setLoading(false);
    setBusy(false);
  }, []);

  return {
    draft,
    confirmedGoal,
    loading,
    busy,
    error,
    accept,
    revise,
    returnToInterview,
    reload: load,
    reset,
  };
}
