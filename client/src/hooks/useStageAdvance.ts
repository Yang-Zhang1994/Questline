import { useCallback, useState } from 'react';
import type { CompleteStageResponse } from '@questline/shared';
import { completeStage } from '../api/milestones';

/**
 * Confirm-before-save stage clear (#10).
 */
export function useStageAdvance() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompleteStageResponse | null>(null);

  const confirm = useCallback(async (milestoneId: number) => {
    setBusy(true);
    setError(null);
    try {
      const payload = await completeStage(milestoneId);
      setResult(payload);
      return payload;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not mark this stage complete';
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const dismissResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    busy,
    error,
    result,
    confirm,
    dismissResult,
  };
}
