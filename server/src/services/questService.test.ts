import { describe, expect, it, vi } from 'vitest';
import type { Milestone, ProposedQuest, Quest, RoadmapGoal } from '@questline/shared';
import { createClaudeClient, createEchoChatClient, type ChatAiClient } from '../ai/client.js';
import type { Clock } from '../clock.js';
import {
  STAMPS_PER_CARD,
  XP_PER_QUEST,
  XP_TO_REACH_LEVEL,
  applyActiveDay,
  buildStampCardSnapshot,
  progressSnapshotFromXp,
  revertActiveDay,
  type StampRowInput,
} from '../config/game.js';
import type { ProgressRepository } from '../repositories/progressRepository.js';
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
    const savedRows: Array<Quest & { completed_local_date?: string | null }> = [
      ...(options?.initialQuests ?? []),
    ];
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
      async findByIdForUser(userId: number, id: number) {
        if (userId !== 1) return null;
        return savedRows.find((q) => q.id === id) ?? null;
      },
      async listDueOnDateForActiveGoal() {
        return { goalTitle: null, milestoneTitle: null, quests: [] };
      },
      async setCompletedAtForUser(userId: number, id: number, completedAt: string | null) {
        if (userId !== 1) return null;
        const idx = savedRows.findIndex((q) => q.id === id);
        if (idx === -1) return null;
        const updated: Quest = {
          ...savedRows[idx],
          completed_at: completedAt,
        };
        savedRows[idx] = updated;
        return updated;
      },
      async setCompletionWithXp(
        userId: number,
        id: number,
        completedAt: string | null,
        xpDelta: number,
        localDate: string,
      ) {
        if (userId !== 1) return null;
        const idx = savedRows.findIndex((q) => q.id === id);
        if (idx === -1) return null;
        const previousCompletedLocalDate = savedRows[idx].completed_local_date ?? null;
        const nextCompletedLocalDate = completedAt !== null ? localDate : null;
        const updated: Quest & { completed_local_date?: string | null } = {
          ...savedRows[idx],
          completed_at: completedAt,
          completed_local_date: nextCompletedLocalDate,
        };
        savedRows[idx] = updated;
        const store = (globalThis as unknown as {
          __xpStore?: {
            xp: number;
            current_streak: number;
            best_streak: number;
            last_active_date: string | null;
            active_day_completions: number;
            stamps: StampRowInput[];
          };
        }).__xpStore;
        const previousXp = store?.xp ?? 0;
        const previousLevel = progressSnapshotFromXp(previousXp).level;
        const nextXp = Math.max(0, previousXp + xpDelta);
        let streak = {
          current_streak: store?.current_streak ?? 0,
          best_streak: store?.best_streak ?? 0,
          last_active_date: store?.last_active_date ?? null,
        };
        let activeDay = store?.active_day_completions ?? 0;
        if (xpDelta > 0) {
          if (streak.last_active_date === localDate) {
            activeDay += 1;
          } else {
            streak = applyActiveDay(streak, localDate);
            activeDay = 1;
          }
        } else if (streak.last_active_date === localDate) {
          activeDay = Math.max(0, activeDay - 1);
          if (activeDay === 0) {
            streak = revertActiveDay(streak, localDate);
          }
        }
        const stamps = store?.stamps ?? [];
        let cardCompleted = false;
        let completedCardNumber: number | null = null;
        if (completedAt !== null) {
          if (!stamps.some((s) => s.stamp_date === localDate)) {
            const maxCard = stamps.reduce((m, s) => Math.max(m, s.card_number), 1);
            const countOnMax = stamps.filter((s) => s.card_number === maxCard).length;
            const targetCard = countOnMax >= STAMPS_PER_CARD ? maxCard + 1 : maxCard;
            const currentCount = countOnMax >= STAMPS_PER_CARD ? 0 : countOnMax;
            stamps.push({ card_number: targetCard, stamp_date: localDate });
            if (currentCount + 1 === STAMPS_PER_CARD) {
              cardCompleted = true;
              completedCardNumber = targetCard;
            }
          }
        } else {
          const stampDateToCheck = previousCompletedLocalDate ?? localDate;
          const remaining = savedRows.filter(
            (q) => q.completed_at !== null && q.completed_local_date === stampDateToCheck,
          );
          if (remaining.length === 0) {
            const sIdx = stamps.findIndex((s) => s.stamp_date === stampDateToCheck);
            if (sIdx !== -1) stamps.splice(sIdx, 1);
          }
        }
        if (store) {
          store.xp = nextXp;
          store.current_streak = streak.current_streak;
          store.best_streak = streak.best_streak;
          store.last_active_date = streak.last_active_date;
          store.active_day_completions = activeDay;
          store.stamps = stamps;
        }
        return {
          quest: {
            id: updated.id,
            milestone_id: updated.milestone_id,
            title: updated.title,
            due_date: updated.due_date,
            estimated_minutes: updated.estimated_minutes,
            completed_at: updated.completed_at,
          },
          progress: progressSnapshotFromXp(nextXp, streak),
          previousLevel,
          stampCard: buildStampCardSnapshot(stamps),
          cardCompleted,
          completedCardNumber,
        };
      },
    };
  }

  function buildProgress(
    initialXp = 0,
    initialStamps: StampRowInput[] = [],
  ): ProgressRepository & { xp: number; stamps: StampRowInput[] } {
    const store = {
      xp: initialXp,
      current_streak: 0,
      best_streak: 0,
      last_active_date: null as string | null,
      active_day_completions: 0,
      stamps: [...initialStamps],
    };
    (globalThis as unknown as { __xpStore: typeof store }).__xpStore = store;
    return {
      get xp() {
        return store.xp;
      },
      get stamps() {
        return store.stamps;
      },
      async getOrCreate(_userId: number, _localDate?: string) {
        return progressSnapshotFromXp(store.xp, {
          current_streak: store.current_streak,
          best_streak: store.best_streak,
          last_active_date: store.last_active_date,
        });
      },
      async getStampCard(_userId: number) {
        return buildStampCardSnapshot(store.stamps);
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
      progress: buildProgress(),
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

  it('normalizes free-text goal.deadline via mapGoalRowToRoadmapGoal so client schema validation succeeds', async () => {
    const { CurrentMilestoneQuestsResponseSchema } = await import('@questline/shared');
    const freeTextGoal: RoadmapGoal = {
      ...activeGoal,
      deadline: 'in about one year',
    };
    const questsRepo = buildQuestRepo({ goal: freeTextGoal });
    const generateDailyQuests = vi.fn(async () => ({
      quests: validProposedQuests,
    }));
    const service = createQuestService({
      quests: questsRepo,
      progress: buildProgress(),
      ai: buildAi(generateDailyQuests),
      clock,
    });

    const getRes = await service.getCurrentMilestoneQuests(1);
    expect(getRes.goal?.deadline).toBeNull();
    expect(CurrentMilestoneQuestsResponseSchema.safeParse(getRes).success).toBe(true);

    const genRes = await service.generateCurrentMilestoneQuests(1);
    expect(genRes.goal?.deadline).toBeNull();
    expect(CurrentMilestoneQuestsResponseSchema.safeParse(genRes).success).toBe(true);
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
      progress: buildProgress(),
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
      progress: buildProgress(),
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
      progress: buildProgress(),
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
      progress: buildProgress(),
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
      progress: buildProgress(),
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
      progress: buildProgress(),
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
      progress: buildProgress(),
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
      progress: buildProgress(),
      ai: buildAi(),
      clock,
    });
    await expect(noGoalService.generateCurrentMilestoneQuests(1)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    } satisfies Partial<AppError>);

    const noMilestoneService = createQuestService({
      quests: buildQuestRepo({ milestone: null }),
      progress: buildProgress(),
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

  describe('toggleQuestCompletion (Issue #9)', () => {
    it('sets completed_at to the server clock timestamp when completed is true, and resets to null when completed is false', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Read 2 pages slowly',
            due_date: '2026-11-10',
            estimated_minutes: 15,
            completed_at: null,
          },
        ],
      });
      const service = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: buildAi(),
        clock: fixedClock('2026-11-10T18:30:00.000Z'),
      });

      const checked = await service.toggleQuestCompletion(1, 1, true);
      expect(checked.quest.id).toBe(1);
      expect(checked.quest.completed_at).toBe('2026-11-10T18:30:00Z');
      expect(checked.progress.xp).toBe(XP_PER_QUEST);
      expect(questsRepo.savedRows[0].completed_at).toBe('2026-11-10T18:30:00Z');

      const unchecked = await service.toggleQuestCompletion(1, 1, false);
      expect(unchecked.quest.id).toBe(1);
      expect(unchecked.quest.completed_at).toBeNull();
      expect(questsRepo.savedRows[0].completed_at).toBeNull();
    });

    it('throws 404 NOT_FOUND when toggling a nonexistent quest or a quest belonging to another user', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'User 1 quest',
            due_date: '2026-11-10',
            estimated_minutes: 15,
            completed_at: null,
          },
        ],
      });
      const service = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: buildAi(),
        clock,
      });

      // Nonexistent quest ID for user 1
      await expect(service.toggleQuestCompletion(1, 999, true)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      } satisfies Partial<AppError>);

      // User 2 trying to toggle user 1's quest
      await expect(service.toggleQuestCompletion(2, 1, true)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      } satisfies Partial<AppError>);

      expect(questsRepo.savedRows[0].completed_at).toBeNull();
    });

    it('awards XP_PER_QUEST when completing a quest and reverses on undo (Issue #11)', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Read 2 pages slowly',
            due_date: '2026-11-10',
            estimated_minutes: 15,
            completed_at: null,
          },
        ],
      });
      const progress = buildProgress(0);
      const service = createQuestService({
        quests: questsRepo,
        progress,
        ai: buildAi(),
        clock: fixedClock('2026-11-10T18:30:00.000Z'),
      });

      const checked = await service.toggleQuestCompletion(1, 1, true, '2026-11-10');
      expect(checked.progress.xp).toBe(XP_PER_QUEST);
      expect(checked.progress.current_streak).toBe(1);
      expect(checked.leveled_up).toBe(false);

      const undone = await service.toggleQuestCompletion(1, 1, false, '2026-11-10');
      expect(undone.progress.xp).toBe(0);
      expect(undone.progress.current_streak).toBe(0);
      expect(undone.quest.completed_at).toBeNull();
    });

    it('counts several same-day completions as one streak day (Issue #12)', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'First quest',
            due_date: '2026-11-10',
            estimated_minutes: 15,
            completed_at: null,
          },
          {
            id: 2,
            milestone_id: currentMilestone.id,
            title: 'Second quest',
            due_date: '2026-11-10',
            estimated_minutes: 10,
            completed_at: null,
          },
        ],
      });
      const progress = buildProgress(0);
      const service = createQuestService({
        quests: questsRepo,
        progress,
        ai: buildAi(),
        clock: fixedClock('2026-11-10T18:30:00.000Z'),
      });

      const first = await service.toggleQuestCompletion(1, 1, true, '2026-11-10');
      expect(first.progress.current_streak).toBe(1);
      const second = await service.toggleQuestCompletion(1, 2, true, '2026-11-10');
      expect(second.progress.current_streak).toBe(1);
      expect(second.progress.xp).toBe(XP_PER_QUEST * 2);
    });

    it('levels up and returns a Mochi celebration when XP crosses a threshold', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Read 2 pages slowly',
            due_date: '2026-11-10',
            estimated_minutes: 15,
            completed_at: null,
          },
        ],
      });
      const progress = buildProgress(XP_TO_REACH_LEVEL[2] - XP_PER_QUEST);
      const service = createQuestService({
        quests: questsRepo,
        progress,
        ai: buildAi(),
        clock,
      });

      const updated = await service.toggleQuestCompletion(1, 1, true);
      expect(updated.progress.level).toBe(2);
      expect(updated.leveled_up).toBe(true);
      expect(updated.level_up_message).toMatch(/Level 2/);
      expect(updated.level_up_message).toMatch(/Mochi/i);
    });

    it('does not double-award XP on an already-completed quest', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Read 2 pages slowly',
            due_date: '2026-11-10',
            estimated_minutes: 15,
            completed_at: null,
          },
        ],
      });
      const progress = buildProgress(0);
      const service = createQuestService({
        quests: questsRepo,
        progress,
        ai: buildAi(),
        clock,
      });

      await service.toggleQuestCompletion(1, 1, true);
      const again = await service.toggleQuestCompletion(1, 1, true);
      expect(again.progress.xp).toBe(XP_PER_QUEST);
      expect(again.leveled_up).toBe(false);
    });

    it('earns one stamp per active day, keeps the stamp if other quests remain that day, and removes the completion-day stamp when undoing the last quest even on a later day (Issue #13)', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Quest A',
            due_date: '2026-11-10',
            estimated_minutes: 15,
            completed_at: null,
          },
          {
            id: 2,
            milestone_id: currentMilestone.id,
            title: 'Quest B',
            due_date: '2026-11-10',
            estimated_minutes: 10,
            completed_at: null,
          },
        ],
      });
      const progress = buildProgress(0);
      let currentIso = '2026-11-10T18:30:00.000Z';
      const service = createQuestService({
        quests: questsRepo,
        progress,
        ai: buildAi(),
        clock: { now: () => new Date(currentIso) },
      });

      // 1. First completion on 2026-11-10 earns 1 stamp
      const first = await service.toggleQuestCompletion(1, 1, true, '2026-11-10');
      expect(first.stamp_card.filled_count).toBe(1);
      expect(first.stamp_card.stamped_dates).toEqual(['2026-11-10']);
      expect(first.card_completed).toBe(false);

      // 2. Second completion on 2026-11-10 does not add another stamp
      const second = await service.toggleQuestCompletion(1, 2, true, '2026-11-10');
      expect(second.stamp_card.filled_count).toBe(1);
      expect(second.stamp_card.stamped_dates).toEqual(['2026-11-10']);

      // 3. Undo Quest A while Quest B is still completed -> stamp for 2026-11-10 stays
      const undoOne = await service.toggleQuestCompletion(1, 1, false, '2026-11-10');
      expect(undoOne.stamp_card.filled_count).toBe(1);
      expect(undoOne.stamp_card.stamped_dates).toEqual(['2026-11-10']);

      // 4. Advance clock to Day 2 (2026-11-11) and undo Quest B -> Day 1's stamp (2026-11-10) is removed
      currentIso = '2026-11-11T12:00:00.000Z';
      const undoLastOnDay2 = await service.toggleQuestCompletion(1, 2, false, '2026-11-11');
      expect(undoLastOnDay2.stamp_card.filled_count).toBe(0);
      expect(undoLastOnDay2.stamp_card.stamped_dates).toEqual([]);
    });

    it('fills a 10-slot card, returns Mochi reward message, saves the completed card in past_cards, and starts Card #2 (Issue #13)', async () => {
      const initialNineStamps: StampRowInput[] = Array.from({ length: 9 }, (_, i) => ({
        card_number: 1,
        stamp_date: `2026-11-${String(i + 1).padStart(2, '0')}`,
      }));
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: '10th stamp quest',
            due_date: '2026-11-10',
            estimated_minutes: 15,
            completed_at: null,
          },
        ],
      });
      const progress = buildProgress(0, initialNineStamps);
      const service = createQuestService({
        quests: questsRepo,
        progress,
        ai: buildAi(),
        clock: fixedClock('2026-11-10T18:30:00.000Z'),
      });

      const tenth = await service.toggleQuestCompletion(1, 1, true, '2026-11-10');
      expect(tenth.card_completed).toBe(true);
      expect(tenth.card_reward_message).toMatch(/Stamp Card #1/i);
      expect(tenth.stamp_card.card_number).toBe(2);
      expect(tenth.stamp_card.filled_count).toBe(0);
      expect(tenth.stamp_card.past_cards).toHaveLength(1);
      expect(tenth.stamp_card.past_cards[0].card_number).toBe(1);
      expect(tenth.stamp_card.past_cards[0].stamp_count).toBe(10);

      // Undoing that 10th completion re-opens Card #1 at 9/10
      const undone = await service.toggleQuestCompletion(1, 1, false, '2026-11-10');
      expect(undone.card_completed).toBe(false);
      expect(undone.stamp_card.card_number).toBe(1);
      expect(undone.stamp_card.filled_count).toBe(9);
      expect(undone.stamp_card.past_cards).toEqual([]);
    });
  });
});
