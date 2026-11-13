import { useCallback, useEffect, useState } from 'react';
import type {
  ChatMessage,
  Milestone,
  ProposedMilestone,
  RoadmapGoal,
} from '@questline/shared';
import { isAiUnavailableError } from '../api/apiError';
import {
  confirmMilestones as confirmMilestonesApi,
  fetchMilestonePlanState,
  proposeMilestones as proposeMilestonesApi,
} from '../api/milestones';

export type UseMilestonePlanOptions = {
  onChatMessagesAdded?: (messages: ChatMessage[]) => void;
};

export function useMilestonePlan(options: UseMilestonePlanOptions = {}) {
  const { onChatMessagesAdded } = options;
  const [goal, setGoal] = useState<RoadmapGoal | null>(null);
  const [savedMilestones, setSavedMilestones] = useState<Milestone[]>([]);
  const [draftMilestones, setDraftMilestones] = useState<ProposedMilestone[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setAiUnavailable(false);
    try {
      const payload = await fetchMilestonePlanState();
      setGoal(payload.goal);
      setSavedMilestones(payload.milestones);
    } catch (err) {
      // Keep goal null when no active goal or endpoint is unavailable in isolated tests
      setGoal(null);
      setSavedMilestones([]);
      setAiUnavailable(isAiUnavailableError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const propose = useCallback(async () => {
    setProposing(true);
    setError(null);
    setAiUnavailable(false);
    setConfirmed(false);
    try {
      const payload = await proposeMilestonesApi({});
      setGoal(payload.goal);
      setDraftMilestones(payload.milestones);
      onChatMessagesAdded?.([payload.mochi_message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not propose milestones');
      setAiUnavailable(isAiUnavailableError(err));
    } finally {
      setProposing(false);
    }
  }, [onChatMessagesAdded]);

  const adjust = useCallback(
    async (feedback: string) => {
      const trimmed = feedback.trim();
      if (!trimmed) return;
      setProposing(true);
      setError(null);
      setAiUnavailable(false);
      setConfirmed(false);
      try {
        const payload = await proposeMilestonesApi({
          feedback: trimmed,
          current_draft: draftMilestones ?? undefined,
        });
        setGoal(payload.goal);
        setDraftMilestones(payload.milestones);
        const added: ChatMessage[] = [];
        if (payload.user_message) added.push(payload.user_message);
        added.push(payload.mochi_message);
        onChatMessagesAdded?.(added);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not adjust milestones');
        setAiUnavailable(isAiUnavailableError(err));
      } finally {
        setProposing(false);
      }
    },
    [draftMilestones, onChatMessagesAdded],
  );

  const reset = useCallback(() => {
    setDraftMilestones(null);
    setConfirmed(false);
    setError(null);
    setAiUnavailable(false);
  }, []);

  const confirm = useCallback(async () => {
    if (!draftMilestones || draftMilestones.length === 0) return;
    setConfirming(true);
    setError(null);
    try {
      const payload = await confirmMilestonesApi(draftMilestones);
      setGoal(payload.goal);
      setSavedMilestones(payload.milestones);
      setDraftMilestones(null);
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm milestones');
    } finally {
      setConfirming(false);
    }
  }, [draftMilestones]);

  return {
    goal,
    savedMilestones,
    draftMilestones,
    loading,
    proposing,
    confirming,
    confirmed,
    error,
    aiUnavailable,
    propose,
    adjust,
    confirm,
    reload,
    reset,
  };
}
