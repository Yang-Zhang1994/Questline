import {
  MilestonePlanAiResponseSchema,
  createMilestoneProposalListSchema,
  type ChatMessage,
  type ConfirmMilestonesResponse,
  type MilestonePlanStateResponse,
  type ProposeMilestonesResponse,
  type ProposedMilestone,
} from '@questline/shared';
import type { ChatAiClient, ClaudeChatTurn } from '../ai/client.js';
import { buildDefaultMilestoneProposal } from '../ai/prompts/mochiMilestones.js';
import type { Clock } from '../clock.js';
import { formatLocalDate, toIsoDateTime } from '../clock.js';
import type { ChatRepository } from '../repositories/chatRepository.js';
import { mapGoalRowToRoadmapGoal } from '../repositories/goalRepository.js';
import type { MilestoneRepository } from '../repositories/milestoneRepository.js';
import { aiUnavailable, conflict, notFound, validationError } from './errors.js';

export type MilestoneServiceDeps = {
  milestones: MilestoneRepository;
  chat: ChatRepository;
  ai: ChatAiClient;
  clock: Clock;
};

export type ProposeMilestonesOptions = {
  feedback?: string;
  current_draft?: ProposedMilestone[];
};

function toClaudeHistory(messages: ChatMessage[]): ClaudeChatTurn[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'mochi')
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }));
}

export function createMilestoneService(deps: MilestoneServiceDeps) {
  async function loadNormalizedActiveGoal(userId: number) {
    const rawGoal = await deps.milestones.getActiveGoalForUser(userId);
    if (!rawGoal) return null;
    return mapGoalRowToRoadmapGoal({
      id: rawGoal.id,
      title: rawGoal.title,
      done_definition: rawGoal.done_definition ?? null,
      starting_point: rawGoal.starting_point ?? null,
      time_budget_minutes_per_day: rawGoal.time_budget_minutes_per_day ?? null,
      deadline: rawGoal.deadline,
      status: rawGoal.status,
    });
  }

  async function getMilestonePlanState(userId: number): Promise<MilestonePlanStateResponse> {
    const goal = await loadNormalizedActiveGoal(userId);
    if (!goal) {
      return { goal: null, milestones: [] };
    }
    const milestones = await deps.milestones.listMilestonesForGoal(goal.id, userId);
    return { goal, milestones };
  }

  async function proposeMilestones(
    userId: number,
    options: ProposeMilestonesOptions = {},
  ): Promise<ProposeMilestonesResponse> {
    const goal = await loadNormalizedActiveGoal(userId);
    if (!goal) {
      throw notFound('Confirm a goal first before planning milestones.');
    }

    const history = toClaudeHistory(await deps.chat.listForUser(userId));
    const today = formatLocalDate(deps.clock.now());
    const requestInput = {
      goal,
      today,
      history,
      current_draft: options.current_draft,
      feedback: options.feedback,
    };

    let rawProposal;
    try {
      rawProposal = deps.ai.proposeMilestones
        ? await deps.ai.proposeMilestones(requestInput)
        : buildDefaultMilestoneProposal(requestInput);
    } catch {
      throw aiUnavailable();
    }

    const validationSchema = MilestonePlanAiResponseSchema.extend({
      milestones: createMilestoneProposalListSchema(goal.deadline, today),
    });
    const parsed = validationSchema.safeParse(rawProposal);
    if (!parsed.success) {
      throw aiUnavailable(
        'Mochi got a little tangled while sketching your milestones. Please try again in a moment.',
      );
    }

    const now = deps.clock.now();
    const userCreatedAt = toIsoDateTime(now);
    const mochiCreatedAt = toIsoDateTime(new Date(now.getTime() + 1000));

    const trimmedFeedback = options.feedback?.trim();
    if (trimmedFeedback) {
      const pair = await deps.chat.insertPair(
        userId,
        trimmedFeedback,
        parsed.data.mochi_message,
        userCreatedAt,
        mochiCreatedAt,
        goal.id,
      );
      return {
        goal,
        milestones: parsed.data.milestones,
        user_message: pair.userMessage,
        mochi_message: pair.mochiMessage,
      };
    }

    const mochiMessage = await deps.chat.insert(
      userId,
      'mochi',
      parsed.data.mochi_message,
      userCreatedAt,
      goal.id,
    );

    return {
      goal,
      milestones: parsed.data.milestones,
      user_message: null,
      mochi_message: mochiMessage,
    };
  }

  async function confirmMilestones(
    userId: number,
    proposed: ProposedMilestone[],
  ): Promise<ConfirmMilestonesResponse> {
    const goal = await loadNormalizedActiveGoal(userId);
    if (!goal) {
      throw notFound('No active goal found to confirm milestones for.');
    }

    const today = formatLocalDate(deps.clock.now());
    const listSchema = createMilestoneProposalListSchema(goal.deadline, today);
    const parsed = listSchema.safeParse(proposed);
    if (!parsed.success) {
      const firstMessage = parsed.error.issues[0]?.message ?? 'Invalid milestone plan';
      throw validationError(firstMessage);
    }

    const existing = await deps.milestones.listMilestonesForGoal(goal.id, userId);
    if (existing.length > 0) {
      throw conflict('Milestones have already been confirmed for this goal.');
    }

    const saved = await deps.milestones.saveConfirmedMilestones(userId, goal.id, parsed.data);
    return {
      goal,
      milestones: saved,
    };
  }

  return {
    getMilestonePlanState,
    proposeMilestones,
    confirmMilestones,
  };
}

export type MilestoneService = ReturnType<typeof createMilestoneService>;
