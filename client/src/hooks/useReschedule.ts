import type {
  ChatMessage,
  Milestone,
  Quest,
  RescheduleMove,
  RoadmapGoal,
} from '@questline/shared';

export type UseRescheduleOptions = {
  onChatMessagesAdded?: (messages: ChatMessage[]) => void;
  onConfirmed?: () => void | Promise<void>;
};

export function useReschedule(_options: UseRescheduleOptions = {}) {
  return {
    goal: null as RoadmapGoal | null,
    milestone: null as Milestone | null,
    windowStart: null as string | null,
    windowEnd: null as string | null,
    timeBudgetMinutesPerDay: 30,
    overdueQuests: [] as Quest[],
    existingQuests: [] as Quest[],
    draftMoves: null as RescheduleMove[] | null,
    mochiMessage: null as string | null,
    proposing: false,
    confirming: false,
    confirmed: false,
    error: null as string | null,
    aiUnavailable: false,
    propose: async () => {
      throw new Error('useReschedule.propose not implemented (#14)');
    },
    adjust: async (_feedback: string) => {
      throw new Error('useReschedule.adjust not implemented (#14)');
    },
    confirm: async () => {
      throw new Error('useReschedule.confirm not implemented (#14)');
    },
    reset: () => {},
  };
}
