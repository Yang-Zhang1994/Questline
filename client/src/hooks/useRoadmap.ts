import { useCallback, useEffect, useState } from 'react';
import type { RoadmapResponse } from '@questline/shared';
import { fetchRoadmap } from '../api/roadmap';

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
      setError(err instanceof Error ? err.message : 'Could not load roadmap');
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
