import { useCallback, useEffect, useState } from 'react';
import type { RoadmapResponse } from '@questline/shared';
import { FRIENDLY_ROADMAP_ERROR, fetchRoadmap } from '../api/roadmap';

function toFriendlyErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return FRIENDLY_ROADMAP_ERROR;
  const trimmed = err.message.trim();
  if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return FRIENDLY_ROADMAP_ERROR;
  }
  return trimmed;
}

export function useRoadmap() {
  const [data, setData] = useState<RoadmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchRoadmap();
      setData(payload);
    } catch (err) {
      console.error('Could not load roadmap:', err);
      setError(toFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    loading,
    error,
    reload,
  };
}
