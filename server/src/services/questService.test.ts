import { describe, expect, it, vi } from 'vitest';
import type { Milestone, ProposedQuest, Quest, RoadmapGoal } from '@questline/shared';
import { createClaudeClient, createEchoChatClient, type ChatAiClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import type { QuestRepository } from '../repositories/questRepository.js';
import { AppError } from './errors.js';
import { createQuestService } from './questService.js';

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

const currentMilestone: Milestone = {
  id: 101,
  goal_id: 10,
  position: 1,
  title: 'Master katakana & core particles',
  description: 'Practice katakana and common particles in daily 25-minute sessions.',
  target_date: '2026-12-15',
  status: 'current',
  total_quests: 0,
  done_quests: 0,
};

const validProposedQuests: ProposedQuest[] = [
  {
    title: 'Practice 10 katakana characters (A-Ko) with stroke order',
    due_date: '2026-11-10',
    estimated_minutes: 15,
  },
  {
    title: 'Read 5 short example sentences using particles wa and ga',
    due_date: '2026-11-10',
    estimated_minutes: 10,
  },
  {
    title: 'Practice 10 katakana characters (Sa-To) and quiz flashcards',
    due_date: '2026-11-11',
    estimated_minutes: 15,
  },
  {
    title: 'Write 3 short phrases using the particle wo',
    due_date: '2026-11-11',
    estimated_minutes: 10,
  },
  {
    title: 'Review 20 katakana characters and spot them in a short menu',
    due_date: '2026-11-12',
    estimated_minutes: 20,
  },
];

describe('questService (Issue #7)', () => {
  const clock = fixedClock('2026-11-10T15:00:00.000Z');

  function buildQuestRepo(options?: {
    goal?: RoadmapGoal | null;
    milestone?: Milestone | null;
    initialQuests?: Quest[];
  }): QuestRepository & { savedRows: Quest[] } {
    const goalForUser1 = options?.goal !== undefined ? options.goal : activeGoal;
    const milestoneForUser1 =
      options?.milestone !== undefined ? options.milestone : currentMilestone;
    const savedRows: Quest[] = [...(options?.initialQuests ?? [])];
    let nextId = savedRows.length + 1;

    return {
      get savedRows() {
        return savedRows;
      },
      async getCurrentMilestoneContextForUser(userId: number) {
        if (userId !== 1) return { goal: null, milestone: null };
        if (!goalForUser1) return { goal: null, milestone: null };
        if (!milestoneForUser1) return { goal: goalForUser1, milestone: null };
        return {
          goal: goalForUser1,
          milestone: {
            ...milestoneForUser1,
            total_quests: savedRows.length,
            done_quests: savedRows.filter((q) => q.completed_at !== null).length,
          },
        };
      },
      async listForMilestone(userId: number, milestoneId: number) {
        if (userId !== 1 || !milestoneForUser1 || milestoneForUser1.id !== milestoneId) return [];
        return [...savedRows].sort(
          (a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id,
        );
      },
      async listForMilestoneInWindow(
        userId: number,
        milestoneId: number,
        windowStart: string,
        windowEnd: string,
      ) {
        if (userId !== 1 || !milestoneForUser1 || milestoneForUser1.id !== milestoneId) return [];
        return savedRows.filter((q) => q.due_date >= windowStart && q.due_date <= windowEnd);
      },
      async saveGeneratedQuestsIfEmpty(
        userId: number,
        milestoneId: number,
        windowStart: string,
        windowEnd: string,
        proposedOrGenerator: ProposedQuest[] | (() => Promise<ProposedQuest[]>),
      ) {
        if (userId !== 1 || !milestoneForUser1 || milestoneForUser1.id !== milestoneId) {
          throw new AppError('NOT_FOUND', 'No current milestone found for active goal.', 404);
        }
        const inWindow = savedRows.filter(
          (q) => q.due_date >= windowStart && q.due_date <= windowEnd,
        );
        if (inWindow.length === 0) {
          const proposed =
            typeof proposedOrGenerator === 'function'
              ? await proposedOrGenerator()
              : proposedOrGenerator;
          for (const item of proposed) {
            savedRows.push({
              id: nextId++,
              milestone_id: milestoneId,
              title: item.title,
              due_date: item.due_date,
              estimated_minutes: item.estimated_minutes,
              completed_at: null,
            });
          }
        }
        return [...savedRows].sort(
          (a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id,
        );
      },
      async findByIdForUser() {
        return null;
      },
      async listDueOnDateForActiveGoal() {
        return { goalTitle: null, milestoneTitle: null, quests: [] };
      },
      async setCompletedAtForUser() {
        return null;
      },
    };
  }

  function buildAi(generateDailyQuests?: ChatAiClient['generateDailyQuests']): ChatAiClient {
    return {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
      generateDailyQuests,
    };
  }

  it('getCurrentMilestoneQuests is read-only and never triggers AI generation', async () => {
    const questsRepo = buildQuestRepo();
    const generateDailyQuests = vi.fn();
    const service = createQuestService({
      quests: questsRepo,
      ai: buildAi(generateDailyQuests),
      clock,
    });

    const res = await service.getCurrentMilestoneQuests(1);

    expect(generateDailyQuests).not.toHaveBeenCalled();
    expect(res.goal).toEqual(activeGoal);
    expect(res.milestone?.id).toBe(currentMilestone.id);
    expect(res.window_start).toBe('2026-11-10');
    expect(res.window_end).toBe('2026-11-12');
    expect(res.quests).toEqual([]);
  });

  // AC: Quests are generated for the current milestone only, fit the daily time budget,
  // have title/due_date/estimated_minutes, and are saved.
  it('generateCurrentMilestoneQuests generates and saves quests for the 3-day starting window', async () => {
    const questsRepo = buildQuestRepo();
    const generateDailyQuests = vi.fn(async () => ({
      quests: validProposedQuests,
    }));
    const service = createQuestService({
      quests: questsRepo,
      ai: buildAi(generateDailyQuests),
      clock,
    });

    const result = await service.generateCurrentMilestoneQuests(1);

    expect(generateDailyQuests).toHaveBeenCalledTimes(1);
    expect(generateDailyQuests).toHaveBeenCalledWith({
      goal: activeGoal,
      milestone: currentMilestone,
      windowStart: '2026-11-10',
      windowEnd: '2026-11-12',
      timeBudgetMinutesPerDay: 25,
    });

    expect(result.quests).toHaveLength(5);
    expect(result.milestone?.total_quests).toBe(5);
    expect(questsRepo.savedRows).toHaveLength(5);
    for (const q of result.quests) {
      expect(q.milestone_id).toBe(currentMilestone.id);
      expect(q.title.length).toBeGreaterThan(0);
      expect(q.estimated_minutes).toBeGreaterThan(0);
      expect(q.due_date >= '2026-11-10' && q.due_date <= '2026-11-12').toBe(true);
    }
  });

  // AC: Not regenerated on every page load — only generate if quests don't already exist for that milestone and window
  it('does not call AI or duplicate quests when quests already exist in the window', async () => {
    const questsRepo = buildQuestRepo({
      initialQuests: [
        {
          id: 1,
          milestone_id: currentMilestone.id,
          title: 'Existing quest for today',
          due_date: '2026-11-10',
          estimated_minutes: 15,
          completed_at: null,
        },
      ],
    });
    const generateDailyQuests = vi.fn(async () => ({
      quests: validProposedQuests,
    }));
    const service = createQuestService({
      quests: questsRepo,
      ai: buildAi(generateDailyQuests),
      clock,
    });

    const result = await service.generateCurrentMilestoneQuests(1);

    expect(generateDailyQuests).not.toHaveBeenCalled();
    expect(result.quests).toHaveLength(1);
    expect(result.quests[0].title).toBe('Existing quest for today');
  });

  // Rule: If the goal's time_budget_minutes_per_day is null, use a default of 30 minutes
  it('defaults timeBudgetMinutesPerDay to 30 when goal.time_budget_minutes_per_day is null', async () => {
    const goalWithoutBudget: RoadmapGoal = {
      ...activeGoal,
      time_budget_minutes_per_day: null,
    };
    const questsRepo = buildQuestRepo({ goal: goalWithoutBudget });
    const generateDailyQuests = vi.fn(async () => ({
      quests: [
        {
          title: '30-minute reading session',
          due_date: '2026-11-10',
          estimated_minutes: 30,
        },
      ],
    }));
    const service = createQuestService({
      quests: questsRepo,
      ai: buildAi(generateDailyQuests),
      clock,
    });

    const result = await service.generateCurrentMilestoneQuests(1);

    expect(generateDailyQuests).toHaveBeenCalledWith(
      expect.objectContaining({
        timeBudgetMinutesPerDay: 30,
      }),
    );
    expect(result.quests).toHaveLength(1);
    expect(result.quests[0].estimated_minutes).toBe(30);
  });

  it('clamps window_end to the milestone target_date when target_date is within 2 days of today', async () => {
    const tightMilestone: Milestone = {
      ...currentMilestone,
      target_date: '2026-11-11',
    };
    const questsRepo = buildQuestRepo({ milestone: tightMilestone });
    const generateDailyQuests = vi.fn(async () => ({
      quests: validProposedQuests.filter((q) => q.due_date <= '2026-11-11'),
    }));
    const service = createQuestService({
      quests: questsRepo,
      ai: buildAi(generateDailyQuests),
      clock,
    });

    const result = await service.generateCurrentMilestoneQuests(1);

    expect(result.window_start).toBe('2026-11-10');
    expect(result.window_end).toBe('2026-11-11');
    expect(generateDailyQuests).toHaveBeenCalledWith(
      expect.objectContaining({
        windowStart: '2026-11-10',
        windowEnd: '2026-11-11',
      }),
    );
  });

  // AC: Validate the AI's quests with Zod: non-empty title, positive integer estimated_minutes,
  // valid due_date within window and not after milestone target_date, daily sum <= time_budget_minutes_per_day.
  it('handles invalid AI quest output gracefully with 503 AI_UNAVAILABLE and saves nothing', async () => {
    const questsRepo = buildQuestRepo();

    // 1. Total minutes on 2026-11-10 is 20 + 15 = 35 > 25 daily budget
    const overBudgetService = createQuestService({
      quests: questsRepo,
      ai: buildAi(async () => ({
        quests: [
          { title: 'Part 1', due_date: '2026-11-10', estimated_minutes: 20 },
          { title: 'Part 2', due_date: '2026-11-10', estimated_minutes: 15 },
        ],
      })),
      clock,
    });

    await expect(overBudgetService.generateCurrentMilestoneQuests(1)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      status: 503,
    } satisfies Partial<AppError>);

    // 2. Quest due_date outside the 3-day window (2026-11-15 > 2026-11-12)
    const outsideWindowService = createQuestService({
      quests: questsRepo,
      ai: buildAi(async () => ({
        quests: [{ title: 'Too far ahead', due_date: '2026-11-15', estimated_minutes: 15 }],
      })),
      clock,
    });

    await expect(outsideWindowService.generateCurrentMilestoneQuests(1)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      status: 503,
    } satisfies Partial<AppError>);

    // 3. Empty title or non-integer/non-positive estimated_minutes
    const badFieldsService = createQuestService({
      quests: questsRepo,
      ai: buildAi(async () => ({
        quests: [{ title: '   ', due_date: '2026-11-10', estimated_minutes: 0 }],
      })),
      clock,
    });

    await expect(badFieldsService.generateCurrentMilestoneQuests(1)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      status: 503,
    } satisfies Partial<AppError>);

    expect(questsRepo.savedRows).toHaveLength(0);
  });

  it('returns 404 NOT_FOUND on generate when the user has no active goal or no current milestone', async () => {
    const noGoalService = createQuestService({
      quests: buildQuestRepo({ goal: null }),
      ai: buildAi(),
      clock,
    });
    await expect(noGoalService.generateCurrentMilestoneQuests(1)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    } satisfies Partial<AppError>);

    const noMilestoneService = createQuestService({
      quests: buildQuestRepo({ milestone: null }),
      ai: buildAi(),
      clock,
    });
    await expect(noMilestoneService.generateCurrentMilestoneQuests(1)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    } satisfies Partial<AppError>);
  });

  it('retries once in createClaudeClient.generateDailyQuests when the first reply is malformed JSON', async () => {
    const createMock = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not valid json' }],
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ quests: validProposedQuests }),
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

    const response = await claudeClient.generateDailyQuests!({
      goal: activeGoal,
      milestone: currentMilestone,
      windowStart: '2026-11-10',
      windowEnd: '2026-11-12',
      timeBudgetMinutesPerDay: 25,
    });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(response.quests).toEqual(validProposedQuests);
  });

  it('provides valid deterministic quests in createEchoChatClient.generateDailyQuests within budget and window', async () => {
    const echo = createEchoChatClient();
    const response = await echo.generateDailyQuests!({
      goal: activeGoal,
      milestone: currentMilestone,
      windowStart: '2026-11-10',
      windowEnd: '2026-11-12',
      timeBudgetMinutesPerDay: 25,
    });

    expect(response.quests.length).toBeGreaterThanOrEqual(3);
    const byDate = new Map<string, number>();
    for (const q of response.quests) {
      expect(q.due_date >= '2026-11-10' && q.due_date <= '2026-11-12').toBe(true);
      expect(q.estimated_minutes).toBeGreaterThan(0);
      byDate.set(q.due_date, (byDate.get(q.due_date) ?? 0) + q.estimated_minutes);
    }
    for (const total of byDate.values()) {
      expect(total).toBeLessThanOrEqual(25);
    }
  });
});
