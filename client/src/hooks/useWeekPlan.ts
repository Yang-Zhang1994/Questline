import { useCallback, useState } from 'react';
import type {
  ChatMessage,
  Milestone,
  ProposedQuest,
  Quest,
  RoadmapGoal,
} from '@questline/shared';
import { isAiUnavailableError } from '../api/apiError';
import {
  FRIENDLY_WEEK_PLAN_ERROR,
  confirmWeekPlan as confirmWeekPlanApi,
  proposeWeekPlan as proposeWeekPlanApi,
} from '../api/quests';
import { todayLocalDate } from '../lib/localDate';

export type UseWeekPlanOptions = {
  onChatMessagesAdded?: (messages: ChatMessage[]) => void;
};

function toFriendlyError(err: unknown): string {
  if (!(err instanceof Error)) return FRIENDLY_WEEK_PLAN_ERROR;
  const trimmed = err.message.trim();
  if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return FRIENDLY_WEEK_PLAN_ERROR;
  }
  return trimmed;
}

export function useWeekPlan(options: UseWeekPlanOptions = {}) {
  const { onChatMessagesAdded } = options;
  const [goal, setGoal] = useState<RoadmapGoal | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [windowStart, setWindowStart] = useState<string | null>(null);
  const [windowEnd, setWindowEnd] = useState<string | null>(null);
  const [timeBudgetMinutesPerDay, setTimeBudgetMinutesPerDay] = useState<number>(30);
  const [existingQuests, setExistingQuests] = useState<Quest[]>([]);
  const [draftQuests, setDraftQuests] = useState<ProposedQuest[] | null>(null);
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
      const payload = await proposeWeekPlanApi({
        local_date: todayLocalDate(),
      });
      setGoal(payload.goal);
      setMilestone(payload.milestone);
      setWindowStart(payload.window_start);
      setWindowEnd(payload.window_end);
      setTimeBudgetMinutesPerDay(payload.time_budget_minutes_per_day);
      setExistingQuests(payload.existing_quests);
      setDraftQuests(payload.quests);
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
        const payload = await proposeWeekPlanApi({
          local_date: todayLocalDate(),
          feedback: trimmed,
          current_draft: draftQuests ?? undefined,
        });
        setGoal(payload.goal);
        setMilestone(payload.milestone);
        setWindowStart(payload.window_start);
        setWindowEnd(payload.window_end);
        setTimeBudgetMinutesPerDay(payload.time_budget_minutes_per_day);
        setExistingQuests(payload.existing_quests);
        setDraftQuests(payload.quests);
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
    [draftQuests, onChatMessagesAdded],
  );

  const confirm = useCallback(async () => {
    if (!draftQuests || draftQuests.length === 0) return;
    setConfirming(true);
    setError(null);
    try {
      const payload = await confirmWeekPlanApi({
        local_date: todayLocalDate(),
        quests: draftQuests,
      });
      setGoal(payload.goal);
      setMilestone(payload.milestone);
      setWindowStart(payload.window_start);
      setWindowEnd(payload.window_end);
      setExistingQuests(payload.quests);
      setDraftQuests(null);
      setConfirmed(true);
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setConfirming(false);
    }
  }, [draftQuests]);

  const reset = useCallback(() => {
    setDraftQuests(null);
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
    existingQuests,
    draftQuests,
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
