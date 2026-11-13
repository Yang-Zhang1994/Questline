import { useCallback, useEffect, useState } from 'react';
import type { Goal } from '@questline/shared';
import { activateGoal, deleteGoal, fetchGoals, startNewGoal } from '../api/goals';

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchGoals();
      setGoals(payload.goals);
      setActiveGoalId(payload.active_goal_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectGoal = useCallback(async (goalId: number) => {
    if (goalId === activeGoalId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await activateGoal(goalId);
      setGoals(payload.goals);
      setActiveGoalId(payload.active_goal_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch goals');
      throw err;
    } finally {
      setBusy(false);
    }
  }, [activeGoalId]);

  const beginNewGoal = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = await startNewGoal();
      setGoals(payload.goals);
      setActiveGoalId(payload.active_goal_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a new goal');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const removeGoal = useCallback(async (goalId: number) => {
    setBusy(true);
    setError(null);
    try {
      const payload = await deleteGoal(goalId);
      setGoals(payload.goals);
      setActiveGoalId(payload.active_goal_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that goal');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const activeGoal = goals.find((g) => g.id === activeGoalId) ?? null;

  return {
    goals,
    activeGoal,
    activeGoalId,
    loading,
    busy,
    error,
    reload,
    selectGoal,
    beginNewGoal,
    removeGoal,
  };
}
