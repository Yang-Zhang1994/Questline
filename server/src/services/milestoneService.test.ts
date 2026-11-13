import { describe, expect, it, vi } from 'vitest';
import {
  resolveGoalDeadlineDate,
  type Milestone,
  type ProposedMilestone,
  type RoadmapGoal,
} from '@questline/shared';
import { createClaudeClient, createEchoChatClient, type ChatAiClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import type { ChatRepository } from '../repositories/chatRepository.js';
import type { MilestoneRepository } from '../repositories/milestoneRepository.js';
import { AppError } from './errors.js';
import { createMilestoneService } from './milestoneService.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

const activeGoal: RoadmapGoal = {
  id: 10,
  title: 'Read a Japanese novel on my own',
  done_definition: 'Finish one short novel without looking up every word',
  starting_point: 'Know hiragana and ~200 words',
  time_budget_minutes_per_day: 25,
  deadline: '2027-06-30',
  status: 'active',
};

const validDraft: ProposedMilestone[] = [
  {
    title: 'Master katakana & core particles',
    description: 'Practice katakana and common particles in daily 25-minute sessions.',
    target_date: '2026-12-15',
  },
  {
    title: 'Finish Level 1 graded readers',
    description: 'Read 5 short graded stories to build reading confidence.',
    target_date: '2027-02-15',
  },
  {
    title: 'Read a short slice-of-life manga',
    description: 'Follow everyday dialogue with minimal dictionary lookups.',
    target_date: '2027-04-15',
  },
  {
    title: 'Complete first short novel',
    description: 'Read a beginner light novel chapter by chapter before the deadline.',
    target_date: '2027-06-15',
  },
];

describe('milestoneService (Issue #5)', () => {
  const clock = fixedClock('2026-11-10T15:00:00.000Z');

  function buildChatRepo(): ChatRepository {
    let nextId = 1;
    const rows: Array<{
      id: number;
      user_id: number;
      goal_id: number | null;
      role: 'user' | 'mochi';
      content: string;
      created_at: string;
    }> = [];

    return {
      async listForUser(userId: number) {
        return rows.filter((r) => r.user_id === userId);
      },
      async insert(userId, role, content, createdAt, goalId = null) {
        const row = {
          id: nextId++,
          user_id: userId,
          goal_id: goalId,
          role,
          content,
          created_at: createdAt,
        };
        rows.push(row);
        return row;
      },
      async insertPair(userId, userContent, mochiContent, userCreatedAt, mochiCreatedAt, goalId = null) {
        const userMessage = await this.insert(userId, 'user', userContent, userCreatedAt, goalId);
        const mochiMessage = await this.insert(
          userId,
          'mochi',
          mochiContent,
          mochiCreatedAt,
          goalId,
        );
        return { userMessage, mochiMessage };
      },
      async deleteAllForUser(userId: number) {
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (rows[i].user_id === userId) rows.splice(i, 1);
        }
      },
    };
  }

  function buildMilestoneRepo(goalForUser1: RoadmapGoal | null = activeGoal): MilestoneRepository & {
    savedRows: Milestone[];
  } {
    let savedRows: Milestone[] = [];
    return {
      get savedRows() {
        return savedRows;
      },
      async getActiveGoalForUser(userId: number) {
        return userId === 1 ? goalForUser1 : null;
      },
      async listMilestonesForGoal(goalId: number, userId: number) {
        if (userId !== 1 || !goalForUser1 || goalForUser1.id !== goalId) return [];
        return savedRows;
      },
      async saveConfirmedMilestones(userId: number, goalId: number, proposed: ProposedMilestone[]) {
        if (userId !== 1 || !goalForUser1 || goalForUser1.id !== goalId) {
          throw new AppError('NOT_FOUND', 'No active goal found for this user', 404);
        }
        if (savedRows.length > 0) {
          throw new AppError(
            'CONFLICT',
            'Milestones have already been confirmed for this goal.',
            409,
          );
        }
        savedRows = proposed.map((item, idx) => ({
          id: idx + 1,
          goal_id: goalId,
          position: idx + 1,
          title: item.title,
          description: item.description,
          target_date: item.target_date,
          status: idx === 0 ? 'current' : 'upcoming',
          done_quests: 0,
          total_quests: 0,
        }));
        return savedRows;
      },
    };
  }

  // AC: Mochi proposes 3–7 ordered milestones based on confirmed goal, deadline, and time budget;
  // Milestones are NOT saved before confirmation.
  it('proposes 3–7 ordered milestones using the active goal without saving to DB', async () => {
    const chat = buildChatRepo();
    const milestonesRepo = buildMilestoneRepo();
    const proposeMilestones = vi.fn(async () => ({
      mochi_message: 'Here are 4 stages for your novel journey ♡',
      milestones: validDraft,
    }));
    const ai: ChatAiClient = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
      proposeMilestones,
    };

    const service = createMilestoneService({ milestones: milestonesRepo, chat, ai, clock });
    const result = await service.proposeMilestones(1);

    expect(proposeMilestones).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: activeGoal,
        today: '2026-11-10',
      }),
    );
    expect(result.goal).toEqual(activeGoal);
    expect(result.milestones).toEqual(validDraft);
    expect(result.user_message).toBeNull();
    expect(result.mochi_message.content).toContain('4 stages');
    expect(result.mochi_message.goal_id).toBe(activeGoal.id);
    // Nothing saved in milestones table before confirm
    expect(milestonesRepo.savedRows).toHaveLength(0);
  });

  // AC: User can ask Mochi to add, remove, rename, or reorder milestones before agreeing
  it('allows the user to adjust proposed milestones via chat feedback before confirming', async () => {
    const chat = buildChatRepo();
    const milestonesRepo = buildMilestoneRepo();
    const adjustedDraft: ProposedMilestone[] = [
      validDraft[1],
      {
        ...validDraft[0],
        title: 'Renamed stage: Core grammar & particles',
        target_date: '2027-03-01',
      },
      validDraft[2],
    ];
    const proposeMilestones = vi.fn(async () => ({
      mochi_message: 'I reordered and renamed the stages for you ♡',
      milestones: adjustedDraft,
    }));
    const ai: ChatAiClient = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
      proposeMilestones,
    };

    const service = createMilestoneService({ milestones: milestonesRepo, chat, ai, clock });
    const result = await service.proposeMilestones(1, {
      feedback: 'Drop the last stage and rename stage 1',
      current_draft: validDraft,
    });

    expect(proposeMilestones).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: 'Drop the last stage and rename stage 1',
        current_draft: validDraft,
      }),
    );
    expect(result.milestones).toHaveLength(3);
    expect(result.user_message?.content).toBe('Drop the last stage and rename stage 1');
    expect(result.mochi_message.content).toContain('reordered and renamed');
    expect(milestonesRepo.savedRows).toHaveLength(0);
  });

  // AC: Validate AI's proposed milestones with Zod (3–7, target_date before goal deadline)
  it('handles invalid AI proposals gracefully with AI_UNAVAILABLE (too few milestones or date after deadline)', async () => {
    const chat = buildChatRepo();
    const milestonesRepo = buildMilestoneRepo();

    const tooFewAi: ChatAiClient = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
      proposeMilestones: vi.fn(async () => ({
        mochi_message: 'Only 2 stages',
        milestones: validDraft.slice(0, 2),
      })),
    };
    const serviceTooFew = createMilestoneService({
      milestones: milestonesRepo,
      chat,
      ai: tooFewAi,
      clock,
    });

    await expect(serviceTooFew.proposeMilestones(1)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      status: 503,
    } satisfies Partial<AppError>);

    const pastDeadlineAi: ChatAiClient = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
      proposeMilestones: vi.fn(async () => ({
        mochi_message: 'Stage past deadline',
        milestones: [
          validDraft[0],
          validDraft[1],
          {
            title: 'Too late stage',
            description: 'Target date is after 2027-06-30',
            target_date: '2027-09-01',
          },
        ],
      })),
    };
    const servicePastDeadline = createMilestoneService({
      milestones: milestonesRepo,
      chat,
      ai: pastDeadlineAi,
      clock,
    });

    await expect(servicePastDeadline.proposeMilestones(1)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      status: 503,
    } satisfies Partial<AppError>);
  });

  // AC: Milestones are saved only after confirmation, with position in order, first current, rest upcoming
  it('saves confirmed milestones with ordered positions, first current, and rest upcoming', async () => {
    const chat = buildChatRepo();
    const milestonesRepo = buildMilestoneRepo();
    const ai: ChatAiClient = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
    };

    const service = createMilestoneService({ milestones: milestonesRepo, chat, ai, clock });
    const confirmed = await service.confirmMilestones(1, validDraft);

    expect(confirmed.goal).toEqual(activeGoal);
    expect(confirmed.milestones).toHaveLength(4);
    expect(confirmed.milestones.map((m) => m.position)).toEqual([1, 2, 3, 4]);
    expect(confirmed.milestones.map((m) => m.status)).toEqual([
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(milestonesRepo.savedRows).toHaveLength(4);
  });

  it('rejects a second confirmation call for the same goal with 409 CONFLICT when milestones already exist', async () => {
    const chat = buildChatRepo();
    const milestonesRepo = buildMilestoneRepo();
    const ai: ChatAiClient = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
    };

    const service = createMilestoneService({ milestones: milestonesRepo, chat, ai, clock });
    await service.confirmMilestones(1, validDraft);

    await expect(service.confirmMilestones(1, validDraft)).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
      message: expect.stringMatching(/already been confirmed/i),
    } satisfies Partial<AppError>);
    expect(milestonesRepo.savedRows).toHaveLength(4);
  });

  it('rejects confirmation when the draft is invalid (too few, too many, empty fields, or target_date after goal deadline)', async () => {
    const chat = buildChatRepo();
    const milestonesRepo = buildMilestoneRepo();
    const ai: ChatAiClient = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
    };

    const service = createMilestoneService({ milestones: milestonesRepo, chat, ai, clock });

    // 1. Fewer than 3 milestones
    await expect(service.confirmMilestones(1, validDraft.slice(0, 2))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    } satisfies Partial<AppError>);

    // 2. More than 7 milestones
    const eightMilestones: ProposedMilestone[] = Array.from({ length: 8 }, (_, idx) => ({
      title: `Stage ${idx + 1}`,
      description: 'Short description',
      target_date: `2027-0${idx + 1}-01`,
    }));
    await expect(service.confirmMilestones(1, eightMilestones)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    } satisfies Partial<AppError>);

    // 3. Empty title
    await expect(
      service.confirmMilestones(1, [
        { ...validDraft[0], title: '   ' },
        validDraft[1],
        validDraft[2],
      ]),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    } satisfies Partial<AppError>);

    // 4. Milestone target_date after the goal deadline (2027-06-30)
    const pastDeadlineList: ProposedMilestone[] = [
      validDraft[0],
      validDraft[1],
      {
        title: 'Past deadline',
        description: 'After 2027-06-30',
        target_date: '2027-08-01',
      },
    ];

    await expect(service.confirmMilestones(1, pastDeadlineList)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    } satisfies Partial<AppError>);
    expect(milestonesRepo.savedRows).toHaveLength(0);
  });

  it('scopes active goal lookup by user_id and returns NOT_FOUND when user has no active goal', async () => {
    const chat = buildChatRepo();
    const milestonesRepo = buildMilestoneRepo();
    const ai: ChatAiClient = {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
    };

    const service = createMilestoneService({ milestones: milestonesRepo, chat, ai, clock });

    // User 2 does not own User 1's active goal
    await expect(service.proposeMilestones(2)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    } satisfies Partial<AppError>);

    await expect(service.confirmMilestones(2, validDraft)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    } satisfies Partial<AppError>);
  });

  it('retries once in createClaudeClient.proposeMilestones when the first reply is malformed JSON', async () => {
    const createMock = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not valid json at all' }],
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              mochi_message: 'Recovered on retry ♡',
              milestones: validDraft,
            }),
          },
        ],
      });

    const claudeClient = createClaudeClient({
      model: 'claude-test-model',
      anthropic: {
        messages: { create: createMock },
      } as unknown as Parameters<typeof createClaudeClient>[0] extends { anthropic?: infer A }
        ? A
        : never,
    });

    const response = await claudeClient.proposeMilestones!({
      goal: activeGoal,
      today: '2026-11-10',
    });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(response.mochi_message).toBe('Recovered on retry ♡');
    expect(response.milestones).toEqual(validDraft);
  });

  it('provides a valid 4-stage fallback in createEchoChatClient.proposeMilestones and supports adjustments', async () => {
    const echo = createEchoChatClient();
    const initial = await echo.proposeMilestones!({
      goal: activeGoal,
      today: '2026-11-10',
    });

    expect(initial.milestones.length).toBeGreaterThanOrEqual(3);
    expect(initial.milestones.length).toBeLessThanOrEqual(7);
    for (const m of initial.milestones) {
      expect(m.target_date <= activeGoal.deadline!).toBe(true);
    }

    const adjusted = await echo.proposeMilestones!({
      goal: activeGoal,
      today: '2026-11-10',
      current_draft: initial.milestones,
      feedback: 'Add an extra vocabulary stage',
    });
    expect(adjusted.milestones).toHaveLength(initial.milestones.length + 1);
  });

  it.each([
    {
      label: 'clean YYYY-MM-DD deadline',
      rawDeadline: '2027-11-12',
      expectedResolvedDeadline: '2027-11-12',
    },
    {
      label: 'sentence containing a YYYY-MM-DD date',
      rawDeadline: 'by 2027-11-12, about one year from now',
      expectedResolvedDeadline: '2027-11-12',
    },
    {
      label: 'free text with no date (defaults to one year from today)',
      rawDeadline: 'this progress should take one year',
      expectedResolvedDeadline: '2027-11-10',
    },
  ])(
    'proposes and confirms milestones with echo client for $label ("$rawDeadline")',
    async ({ rawDeadline, expectedResolvedDeadline }) => {
      const today = '2026-11-10';
      expect(resolveGoalDeadlineDate(rawDeadline, today)).toBe(expectedResolvedDeadline);

      const goalWithRawDeadline: RoadmapGoal = {
        ...activeGoal,
        deadline: rawDeadline,
      };
      const chat = buildChatRepo();
      const milestonesRepo = buildMilestoneRepo(goalWithRawDeadline);
      const echo = createEchoChatClient();

      const service = createMilestoneService({
        milestones: milestonesRepo,
        chat,
        ai: echo,
        clock,
      });

      const proposed = await service.proposeMilestones(1);
      expect(proposed.milestones.length).toBeGreaterThanOrEqual(3);
      expect(proposed.milestones.length).toBeLessThanOrEqual(7);
      for (const m of proposed.milestones) {
        expect(m.target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(m.target_date <= expectedResolvedDeadline).toBe(true);
      }

      // Rejects a milestone whose target_date is after the resolved deadline
      await expect(
        service.confirmMilestones(1, [
          proposed.milestones[0],
          proposed.milestones[1],
          {
            title: 'Too late stage',
            description: 'Past resolved deadline',
            target_date: '2028-01-01',
          },
        ]),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
      } satisfies Partial<AppError>);

      // Confirms the proposed milestones cleanly
      const confirmed = await service.confirmMilestones(1, proposed.milestones);
      expect(confirmed.milestones).toHaveLength(proposed.milestones.length);
      expect(confirmed.milestones[0].status).toBe('current');
    },
  );
});
