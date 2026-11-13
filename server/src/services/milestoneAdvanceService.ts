import type { CompleteStageResponse } from '@questline/shared';
import { goalCompletedMessage, stageClearedMessage } from '../config/game.js';
import type { MilestoneRepository } from '../repositories/milestoneRepository.js';
import { conflict, notFound, validationError } from './errors.js';

export type MilestoneAdvanceServiceDeps = {
  milestones: MilestoneRepository;
};

/**
 * Confirm-before-save stage clear (#10).
 * Does not touch quest completion / XP / streak — those stay in questService.
 */
export function createMilestoneAdvanceService(deps: MilestoneAdvanceServiceDeps) {
  return {
    async completeStage(userId: number, milestoneId: number): Promise<CompleteStageResponse> {
      try {
        const result = await deps.milestones.completeCurrentAndAdvance(userId, milestoneId);
        const mochi_message = result.goalCompleted
          ? goalCompletedMessage(result.goal.title)
          : stageClearedMessage(result.completed.title, result.next?.title ?? null);

        return {
          completed_milestone: result.completed,
          next_milestone: result.next,
          goal_completed: result.goalCompleted,
          goal: result.goal,
          milestones: result.milestones,
          mochi_message,
        };
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        if (code === 'MILESTONE_NOT_FOUND') {
          throw notFound('That stage was not found on your active goal.');
        }
        if (code === 'MILESTONE_NOT_CURRENT') {
          throw conflict('Only the current stage can be marked complete ♡');
        }
        if (code === 'MILESTONE_QUESTS_INCOMPLETE') {
          throw validationError(
            'A few quests are still open on this stage — check them off when you are ready.',
          );
        }
        if (code === 'MILESTONE_QUESTS_EMPTY') {
          throw validationError(
            'This stage has no quests yet — plan a few tiny ones with Mochi first ♡',
          );
        }
        throw err;
      }
    },
  };
}

export type MilestoneAdvanceService = ReturnType<typeof createMilestoneAdvanceService>;
