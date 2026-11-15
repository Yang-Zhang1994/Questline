import { useCallback, useState } from 'react';
import type {
  ChatMessage,
  Milestone,
  Quest,
  RescheduleMove,
  RoadmapGoal,
} from '@questline/shared';
import { isAiUnavailableError } from '../api/apiError';
import {
  FRIENDLY_RESCHEDULE_ERROR,
  confirmReschedule as confirmRescheduleApi,
  proposeReschedule as proposeRescheduleApi,
} from '../api/quests';
import { todayLocalDate } from '../lib/localDate';

export type UseRescheduleOptions = {
  onChatMessagesAdded?: (messages: ChatMessage[]) => void;
  onConfirmed?: () => void | Promise<void>;
};

function toFriendlyError(err: unknown): string {
  if (!(err instanceof Error)) return FRIENDLY_RESCHEDULE_ERROR;
  const trimmed = err.message.trim();
  if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return FRIENDLY_RESCHEDULE_ERROR;
  }
  return trimmed;
}

export function useReschedule(options: UseRescheduleOptions = {}) {
  const { onChatMessagesAdded, onConfirmed } = options;
  const [goal, setGoal] = useState<RoadmapGoal | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [windowStart, setWindowStart] = useState<string | null>(null);
  const [windowEnd, setWindowEnd] = useState<string | null>(null);
  const [timeBudgetMinutesPerDay, setTimeBudgetMinutesPerDay] = useState<number>(30);
  const [overdueQuests, setOverdueQuests] = useState<Quest[]>([]);
  const [existingQuests, setExistingQuests] = useState<Quest[]>([]);
  const [draftMoves, setDraftMoves] = useState<RescheduleMove[] | null>(null);
  const [mochiMessage, setMochiMessage] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const propose = useCallback(async () => {
    setProposing(true);
    setError(null);
    setAiUnavailable(false);
    setConfirmed(false);
    try {
      const payload = await proposeRescheduleApi({
        local_date: todayLocalDate(),
      });
      setGoal(payload.goal);
      setMilestone(payload.milestone);
      setWindowStart(payload.window_start);
      setWindowEnd(payload.window_end);
      setTimeBudgetMinutesPerDay(payload.time_budget_minutes_per_day);
      setOverdueQuests(payload.overdue_quests);
      setExistingQuests(payload.existing_quests);
      setDraftMoves(payload.moves);
      setMochiMessage(payload.mochi_message.content);
      onChatMessagesAdded?.([payload.mochi_message]);
    } catch (err) {
      setError(toFriendlyError(err));
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
        const payload = await proposeRescheduleApi({
          local_date: todayLocalDate(),
          feedback: trimmed,
          current_draft: draftMoves ?? undefined,
        });
        setGoal(payload.goal);
        setMilestone(payload.milestone);
        setWindowStart(payload.window_start);
        setWindowEnd(payload.window_end);
        setTimeBudgetMinutesPerDay(payload.time_budget_minutes_per_day);
        setOverdueQuests(payload.overdue_quests);
        setExistingQuests(payload.existing_quests);
        setDraftMoves(payload.moves);
        setMochiMessage(payload.mochi_message.content);
        const added: ChatMessage[] = [];
        if (payload.user_message) added.push(payload.user_message);
        added.push(payload.mochi_message);
        onChatMessagesAdded?.(added);
      } catch (err) {
        setError(toFriendlyError(err));
        setAiUnavailable(isAiUnavailableError(err));
      } finally {
        setProposing(false);
      }
    },
    [draftMoves, onChatMessagesAdded],
  );

  const confirm = useCallback(async () => {
    if (!draftMoves || draftMoves.length === 0) return;
    setConfirming(true);
    setError(null);
    try {
      const payload = await confirmRescheduleApi({
        local_date: todayLocalDate(),
        moves: draftMoves,
      });
      setGoal(payload.goal);
      setMilestone(payload.milestone);
      setWindowStart(payload.window_start);
      setWindowEnd(payload.window_end);
      setExistingQuests(payload.quests);
      setDraftMoves(null);
      setConfirmed(true);
      await onConfirmed?.();
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setConfirming(false);
    }
  }, [draftMoves, onConfirmed]);

  const reset = useCallback(() => {
    setDraftMoves(null);
    setMochiMessage(null);
    setConfirmed(false);
    setError(null);
    setAiUnavailable(false);
  }, []);

  return {
    goal,
    milestone,
    windowStart,
    windowEnd,
    timeBudgetMinutesPerDay,
    overdueQuests,
    existingQuests,
    draftMoves,
    mochiMessage,
    proposing,
    confirming,
    confirmed,
    error,
    aiUnavailable,
    propose,
    adjust,
    confirm,
    reset,
  };
}
