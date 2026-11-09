import { useCallback, useEffect, useState } from 'react';
import type { Milestone, MilestoneGoalSummary } from '@questline/shared';
import { fetchMilestonePlan } from '../api/milestones';

/**
 * Read-only Map loader for confirmed milestones (Issue #6).
 * Does NOT auto-propose a draft — that belongs on Talk via useMilestonePlan.
 */
export function useRoadmap() {
  const [goal, setGoal] = useState<MilestoneGoalSummary | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const plan = await fetchMilestonePlan();
      setGoal(plan.goal);
      setMilestones(plan.milestones);
      setConfirmed(plan.confirmed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load your map';
      // No active goal yet — show the blank-map empty state, not a scary alert.
      if (/confirm a goal|not found|unauthorized|401/i.test(message)) {
        setGoal(null);
        setMilestones([]);
        setConfirmed(false);
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

  return {
    goal,
    milestones,
    confirmed,
    loading,
    error,
    reload: load,
  };
}
