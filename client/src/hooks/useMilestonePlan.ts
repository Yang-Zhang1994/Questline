import { useCallback, useEffect, useState } from 'react';
import type { Milestone, MilestoneGoalSummary, MilestonePlanDraft } from '@questline/shared';
import {
  confirmMilestonePlan,
  fetchMilestonePlan,
  proposeMilestonePlan,
  reviseMilestonePlan,
} from '../api/milestones';

/**
 * Loads / proposes a milestone draft for the active confirmed goal.
 * Confirm is the only path that persists milestones (Issue #5).
 */
export function useMilestonePlan() {
  const [draft, setDraft] = useState<MilestonePlanDraft | null>(null);
  const [goal, setGoal] = useState<MilestoneGoalSummary | null>(null);
  const [savedMilestones, setSavedMilestones] = useState<Milestone[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const existing = await fetchMilestonePlan();
      setGoal(existing.goal);
      setSavedMilestones(existing.milestones);
      setConfirmed(existing.confirmed);

      if (existing.draft) {
        setDraft(existing.draft);
        return;
      }

      // Active goal with no saved milestones yet → ask Mochi for a draft.
      if (existing.goal && !existing.confirmed) {
        const proposed = await proposeMilestonePlan();
        setDraft(proposed.draft);
        setGoal(proposed.goal);
        setSavedMilestones(proposed.milestones);
        setConfirmed(proposed.confirmed);
        return;
      }

      setDraft(null);
    } catch (err) {
      // No active goal yet (Issue #4 still open / interview incomplete) — stay quiet.
      const message = err instanceof Error ? err.message : 'Could not load milestone plan';
      if (/confirm a goal|not found/i.test(message)) {
        setDraft(null);
        setGoal(null);
        setConfirmed(false);
        setSavedMilestones([]);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmMilestonePlan(draft);
      setSavedMilestones(result.milestones);
      setGoal(result.goal);
      setDraft(null);
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the milestone plan');
    } finally {
      setBusy(false);
    }
  }, [draft]);

  const revise = useCallback(async (feedback?: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await reviseMilestonePlan(feedback);
      setDraft(result.draft);
      setGoal(result.goal);
      setConfirmed(result.confirmed);
      setSavedMilestones(result.milestones);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revise the milestone plan');
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    setDraft(null);
    setGoal(null);
    setSavedMilestones([]);
    setConfirmed(false);
    setError(null);
    setLoading(false);
    setBusy(false);
  }, []);

  return {
    draft,
    goal,
    savedMilestones,
    confirmed,
    loading,
    busy,
    error,
    confirm,
    revise,
    reload: load,
    reset,
  };
}
