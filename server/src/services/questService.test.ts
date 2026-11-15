import { describe, expect, it, vi } from 'vitest';
import type { Milestone, ProposedQuest, Quest, RescheduleMove, RoadmapGoal } from '@questline/shared';
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
      async saveConfirmedWeekPlanQuests(
        userId: number,
        milestoneId: number,
        windowStart: string,
        windowEnd: string,
        timeBudgetMinutesPerDay: number,
        proposed: ProposedQuest[],
      ) {
        if (userId !== 1 || !milestoneForUser1 || milestoneForUser1.id !== milestoneId) {
          throw new AppError('NOT_FOUND', 'No current milestone found for active goal.', 404);
        }
        const existingTitles = new Set(savedRows.map((q) => q.title.trim().toLowerCase()));
        const seenProposedTitles = new Set<string>();
        const minutesByDate = new Map<string, number>();
        for (const existing of savedRows) {
          if (existing.due_date >= windowStart && existing.due_date <= windowEnd) {
            minutesByDate.set(
              existing.due_date,
              (minutesByDate.get(existing.due_date) ?? 0) + (existing.estimated_minutes ?? 0),
            );
          }
        }
        for (const item of proposed) {
          const norm = item.title.trim().toLowerCase();
          if (existingTitles.has(norm)) {
            throw new AppError(
              'CONFLICT',
              `Quest "${item.title}" has already been added to this stage.`,
              409,
            );
          }
          if (seenProposedTitles.has(norm)) {
            throw new AppError(
              'VALIDATION_ERROR',
              `Quest title "${item.title}" is duplicated in the proposed plan.`,
              400,
            );
          }
          seenProposedTitles.add(norm);
          const nextMins = (minutesByDate.get(item.due_date) ?? 0) + item.estimated_minutes;
          if (nextMins > timeBudgetMinutesPerDay) {
            throw new AppError(
              'VALIDATION_ERROR',
              `Total estimated_minutes on ${item.due_date} (${nextMins}) exceeds daily time budget (${timeBudgetMinutesPerDay})`,
              400,
            );
          }
          minutesByDate.set(item.due_date, nextMins);
        }
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
        return [...savedRows].sort(
          (a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id,
        );
      },
      async saveConfirmedRescheduleMoves(
        userId: number,
        milestoneId: number,
        today: string,
        windowStart: string,
        windowEnd: string,
        timeBudgetMinutesPerDay: number,
        moves: RescheduleMove[],
      ) {
        if (userId !== 1 || !milestoneForUser1 || milestoneForUser1.id !== milestoneId) {
          throw new AppError('NOT_FOUND', 'No current milestone found for active goal.', 404);
        }
        const seenIds = new Set<number>();
        const moveById = new Map<number, RescheduleMove>();
        for (const m of moves) {
          if (seenIds.has(m.quest_id)) {
            throw new AppError('VALIDATION_ERROR', 'Duplicate quest_id in moves.', 400);
          }
          seenIds.add(m.quest_id);
          moveById.set(m.quest_id, m);
          const row = savedRows.find((q) => q.id === m.quest_id);
          if (!row) {
            throw new AppError(
              'CONFLICT',
              'One of those quests was updated or removed — let Mochi take a fresh peek first ♡',
              409,
            );
          }
          if (row.completed_at !== null || row.due_date >= today || row.due_date !== m.from_date) {
            throw new AppError(
              'CONFLICT',
              'Some of your quests have already been checked off or moved — let Mochi refresh the schedule first ♡',
              409,
            );
          }
        }
        const minutesByDate = new Map<string, number>();
        for (const existing of savedRows) {
          if (moveById.has(existing.id)) continue;
          if (existing.due_date >= windowStart && existing.due_date <= windowEnd) {
            minutesByDate.set(
              existing.due_date,
              (minutesByDate.get(existing.due_date) ?? 0) + (existing.estimated_minutes ?? 0),
            );
          }
        }
        for (const m of moves) {
          const nextMins = (minutesByDate.get(m.to_date) ?? 0) + m.estimated_minutes;
          if (nextMins > timeBudgetMinutesPerDay) {
            throw new AppError(
              'VALIDATION_ERROR',
              `Total estimated_minutes on ${m.to_date} (${nextMins}) exceeds daily time budget (${timeBudgetMinutesPerDay})`,
              400,
            );
          }
          minutesByDate.set(m.to_date, nextMins);
        }
        for (const m of moves) {
          const idx = savedRows.findIndex((q) => q.id === m.quest_id);
          if (idx !== -1) {
            savedRows[idx] = {
              ...savedRows[idx],
              due_date: m.to_date,
            };
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

  function buildAi(
    generateDailyQuests?: ChatAiClient['generateDailyQuests'],
    proposeWeekPlan?: ChatAiClient['proposeWeekPlan'],
    proposeReschedule?: ChatAiClient['proposeReschedule'],
  ): ChatAiClient {
    return {
      completeChat: vi.fn(),
      evaluateInterviewAnswer: vi.fn(),
      proposeGoalDraft: vi.fn(),
      reviseGoalDraft: vi.fn(),
      generateDailyQuests,
      proposeWeekPlan,
      proposeReschedule,
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

  describe('proposeWeekPlan & confirmWeekPlan (Issue #15)', () => {
    it('proposes a 7-day plan starting from local_date without saving anything before accepting', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Done quest from today',
            due_date: '2026-11-10',
            estimated_minutes: 10,
            completed_at: '2026-11-10T10:00:00Z',
          },
        ],
      });
      const proposeWeekPlan = vi.fn(async () => ({
        mochi_message: 'Here is your 7-day plan ♡',
        quests: [
          {
            title: 'Remaining 15 min task on 2026-11-10',
            due_date: '2026-11-10',
            estimated_minutes: 15,
          },
          {
            title: 'Next step on 2026-11-16 (7th day)',
            due_date: '2026-11-16',
            estimated_minutes: 20,
          },
        ],
      }));
      const service = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: buildAi(undefined, proposeWeekPlan),
        clock,
      });

      const proposal = await service.proposeWeekPlan(1, { local_date: '2026-11-10' });

      expect(proposal.window_start).toBe('2026-11-10');
      expect(proposal.window_end).toBe('2026-11-16');
      expect(proposal.time_budget_minutes_per_day).toBe(25);
      expect(proposal.existing_quests).toHaveLength(1);
      expect(proposal.quests).toHaveLength(2);
      expect(proposal.mochi_message.content).toContain('7-day plan');
      expect(proposeWeekPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          windowStart: '2026-11-10',
          windowEnd: '2026-11-16',
          timeBudgetMinutesPerDay: 25,
          existingQuests: expect.arrayContaining([
            expect.objectContaining({ title: 'Done quest from today' }),
          ]),
        }),
      );
      // Nothing saved before accepting
      expect(questsRepo.savedRows).toHaveLength(1);
    });

    it('cuts off the 7-day window at milestone.target_date when target_date comes sooner, and uses the full 7-day window when target_date has already passed (like #7)', async () => {
      // 1. Milestone target_date is 2026-11-13 (3 days after 2026-11-10) -> cut off at 2026-11-13
      const soonMilestone: Milestone = {
        ...currentMilestone,
        target_date: '2026-11-13',
      };
      const soonRepo = buildQuestRepo({ milestone: soonMilestone });
      const echo = createEchoChatClient();
      const soonService = createQuestService({
        quests: soonRepo,
        progress: buildProgress(),
        ai: echo,
        clock,
      });

      const soonProposal = await soonService.proposeWeekPlan(1, { local_date: '2026-11-10' });
      expect(soonProposal.window_start).toBe('2026-11-10');
      expect(soonProposal.window_end).toBe('2026-11-13');
      for (const q of soonProposal.quests) {
        expect(q.due_date >= '2026-11-10' && q.due_date <= '2026-11-13').toBe(true);
      }

      // 2. Milestone target_date has already passed (2026-11-05 < 2026-11-10) -> full 7-day window 2026-11-10..2026-11-16
      const passedMilestone: Milestone = {
        ...currentMilestone,
        target_date: '2026-11-05',
      };
      const passedRepo = buildQuestRepo({ milestone: passedMilestone });
      const passedService = createQuestService({
        quests: passedRepo,
        progress: buildProgress(),
        ai: echo,
        clock,
      });

      const passedProposal = await passedService.proposeWeekPlan(1, { local_date: '2026-11-10' });
      expect(passedProposal.window_start).toBe('2026-11-10');
      expect(passedProposal.window_end).toBe('2026-11-16');
      expect(passedProposal.quests.some((q) => q.due_date === '2026-11-16')).toBe(true);

      const confirmedPassed = await passedService.confirmWeekPlan(1, {
        local_date: '2026-11-10',
        quests: passedProposal.quests,
      });
      expect(confirmedPassed.window_start).toBe('2026-11-10');
      expect(confirmedPassed.window_end).toBe('2026-11-16');
      expect(confirmedPassed.quests.length).toBeGreaterThanOrEqual(7);
    });

    it('enforces daily time budget including existing quests (and defaults budget to 30 when missing)', async () => {
      const goalNoBudget: RoadmapGoal = {
        ...activeGoal,
        time_budget_minutes_per_day: null, // defaults to 30
      };
      const questsRepo = buildQuestRepo({
        goal: goalNoBudget,
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Already scheduled 20m quest',
            due_date: '2026-11-10',
            estimated_minutes: 20,
            completed_at: null,
          },
        ],
      });

      // AI proposes 15m on 2026-11-10 -> 20 + 15 = 35 > 30 default budget -> 503 AI_UNAVAILABLE
      const overBudgetService = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: buildAi(undefined, async () => ({
          mochi_message: 'Over budget',
          quests: [
            {
              title: 'New 15m quest on same day',
              due_date: '2026-11-10',
              estimated_minutes: 15,
            },
          ],
        })),
        clock,
      });

      await expect(overBudgetService.proposeWeekPlan(1)).rejects.toMatchObject({
        code: 'AI_UNAVAILABLE',
        status: 503,
      } satisfies Partial<AppError>);

      // Confirm also rejects over-budget quests with 400 VALIDATION_ERROR
      await expect(
        overBudgetService.confirmWeekPlan(1, {
          quests: [
            {
              title: 'New 15m quest on same day',
              due_date: '2026-11-10',
              estimated_minutes: 15,
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
      } satisfies Partial<AppError>);

      // Fitting within remaining 10m (20 + 10 = 30 <= 30) succeeds
      const fittingService = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: buildAi(undefined, async () => ({
          mochi_message: 'Fits remaining 10 minutes ♡',
          quests: [
            {
              title: 'New 10m quest on 2026-11-10',
              due_date: '2026-11-10',
              estimated_minutes: 10,
            },
          ],
        })),
        clock,
      });

      const proposal = await fittingService.proposeWeekPlan(1);
      expect(proposal.time_budget_minutes_per_day).toBe(30);
      expect(proposal.quests).toHaveLength(1);
    });

    it('rejects duplicate titles against existing quests or within the proposed plan', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Practice 10 katakana characters',
            due_date: '2026-11-10',
            estimated_minutes: 10,
            completed_at: '2026-11-10T12:00:00Z',
          },
        ],
      });

      // 1. AI duplicates existing quest title (case-insensitive) -> 503 AI_UNAVAILABLE
      const dupExistingAiService = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: buildAi(undefined, async () => ({
          mochi_message: 'Dup existing',
          quests: [
            {
              title: '  practice 10 KATAKANA characters ',
              due_date: '2026-11-11',
              estimated_minutes: 15,
            },
          ],
        })),
        clock,
      });

      await expect(dupExistingAiService.proposeWeekPlan(1)).rejects.toMatchObject({
        code: 'AI_UNAVAILABLE',
        status: 503,
      } satisfies Partial<AppError>);

      // 2. Duplicate titles within the proposed list -> 400 VALIDATION_ERROR on confirm
      await expect(
        dupExistingAiService.confirmWeekPlan(1, {
          quests: [
            { title: 'Brand new step', due_date: '2026-11-11', estimated_minutes: 10 },
            { title: 'brand new step', due_date: '2026-11-12', estimated_minutes: 10 },
          ],
        }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
      } satisfies Partial<AppError>);
    });

    it('saves confirmed quests while preserving existing quests and rejects a double accept with 409 CONFLICT', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Completed day 1 quest',
            due_date: '2026-11-10',
            estimated_minutes: 10,
            completed_at: '2026-11-10T09:00:00Z',
          },
        ],
      });
      const echo = createEchoChatClient();
      const service = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: echo,
        clock,
      });

      const proposal = await service.proposeWeekPlan(1, { local_date: '2026-11-10' });
      expect(questsRepo.savedRows).toHaveLength(1);

      const confirmed = await service.confirmWeekPlan(1, {
        local_date: '2026-11-10',
        quests: proposal.quests,
      });
      expect(confirmed.quests).toHaveLength(1 + proposal.quests.length);
      expect(confirmed.quests[0].title).toBe('Completed day 1 quest');

      // Double accept of the same draft is rejected with 409 CONFLICT and does not add quests twice
      await expect(
        service.confirmWeekPlan(1, {
          local_date: '2026-11-10',
          quests: proposal.quests,
        }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        status: 409,
      } satisfies Partial<AppError>);
      expect(questsRepo.savedRows).toHaveLength(1 + proposal.quests.length);
    });

    it('rejects another user from proposing or confirming for user 1’s milestone with 404 NOT_FOUND', async () => {
      const questsRepo = buildQuestRepo();
      const service = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: createEchoChatClient(),
        clock,
      });

      await expect(service.proposeWeekPlan(2)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      } satisfies Partial<AppError>);

      await expect(
        service.confirmWeekPlan(2, {
          quests: [{ title: 'Intruder quest', due_date: '2026-11-10', estimated_minutes: 15 }],
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      } satisfies Partial<AppError>);
      expect(questsRepo.savedRows).toHaveLength(0);
    });

    it('retries once in createClaudeClient.proposeWeekPlan when the first reply is malformed JSON', async () => {
      const createMock = vi
        .fn()
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'oops not json' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                mochi_message: 'Recovered week plan ♡',
                quests: [
                  {
                    title: 'Fresh katakana drill',
                    due_date: '2026-11-10',
                    estimated_minutes: 15,
                  },
                ],
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

      const response = await claudeClient.proposeWeekPlan!({
        goal: activeGoal,
        milestone: currentMilestone,
        windowStart: '2026-11-10',
        windowEnd: '2026-11-16',
        timeBudgetMinutesPerDay: 25,
        existingQuests: [],
      });

      expect(createMock).toHaveBeenCalledTimes(2);
      expect(response.mochi_message).toBe('Recovered week plan ♡');
      expect(response.quests).toHaveLength(1);
    });
  });

  describe('proposeReschedule & confirmReschedule (Issue #14)', () => {
    const GUILT_WORDS_REGEX = /\b(overdue|late|behind|failed|fail|failure)\b/i;

    it('identifies only incomplete quests on the current milestone with due_date < local_date as needing rescheduling, and saves nothing before confirming', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Earlier incomplete quest from Nov 8',
            due_date: '2026-11-08',
            estimated_minutes: 15,
            completed_at: null,
          },
          {
            id: 2,
            milestone_id: currentMilestone.id,
            title: 'Earlier completed quest from Nov 8 (must NOT be moved)',
            due_date: '2026-11-08',
            estimated_minutes: 10,
            completed_at: '2026-11-08T12:00:00Z',
          },
          {
            id: 3,
            milestone_id: currentMilestone.id,
            title: 'Today quest on Nov 10 (must NOT be treated as past-due)',
            due_date: '2026-11-10',
            estimated_minutes: 10,
            completed_at: null,
          },
          {
            id: 4,
            milestone_id: currentMilestone.id,
            title: 'Future quest on Nov 12',
            due_date: '2026-11-12',
            estimated_minutes: 15,
            completed_at: null,
          },
        ],
      });

      const echo = createEchoChatClient();
      const service = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: echo,
        clock,
      });

      const proposal = await service.proposeReschedule(1, { local_date: '2026-11-10' });

      expect(proposal.overdue_quests.map((q) => q.id)).toEqual([1]);
      expect(proposal.moves).toHaveLength(1);
      expect(proposal.moves[0]).toMatchObject({
        quest_id: 1,
        title: 'Earlier incomplete quest from Nov 8',
        from_date: '2026-11-08',
        estimated_minutes: 15,
      });
      expect(proposal.moves[0].to_date >= '2026-11-10').toBe(true);
      expect(proposal.mochi_message.content).not.toMatch(GUILT_WORDS_REGEX);

      // Nothing saved before confirming
      expect(questsRepo.savedRows.find((q) => q.id === 1)?.due_date).toBe('2026-11-08');
    });

    it('fits rescheduled quests around existing quests on each day within the daily time budget (defaulting to 30 when null)', async () => {
      const goalNoBudget: RoadmapGoal = {
        ...activeGoal,
        time_budget_minutes_per_day: null, // defaults to 30
      };
      const questsRepo = buildQuestRepo({
        goal: goalNoBudget,
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Earlier 20m quest A',
            due_date: '2026-11-08',
            estimated_minutes: 20,
            completed_at: null,
          },
          {
            id: 2,
            milestone_id: currentMilestone.id,
            title: 'Earlier 15m quest B',
            due_date: '2026-11-09',
            estimated_minutes: 15,
            completed_at: null,
          },
          {
            id: 3,
            milestone_id: currentMilestone.id,
            title: 'Already on today (2026-11-10) taking 15m',
            due_date: '2026-11-10',
            estimated_minutes: 15,
            completed_at: null,
          },
        ],
      });

      const echo = createEchoChatClient();
      const service = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: echo,
        clock,
      });

      const proposal = await service.proposeReschedule(1, { local_date: '2026-11-10' });
      expect(proposal.time_budget_minutes_per_day).toBe(30);
      expect(proposal.moves).toHaveLength(2);

      // Verify every day's total (existing + moved) is <= 30
      const totalsByDate = new Map<string, number>();
      totalsByDate.set('2026-11-10', 15);
      for (const m of proposal.moves) {
        totalsByDate.set(m.to_date, (totalsByDate.get(m.to_date) ?? 0) + m.estimated_minutes);
      }
      for (const total of totalsByDate.values()) {
        expect(total).toBeLessThanOrEqual(30);
      }

      // Rejects AI or confirm moves that push a day over budget
      await expect(
        service.confirmReschedule(1, {
          local_date: '2026-11-10',
          moves: [
            {
              quest_id: 1,
              title: 'Earlier 20m quest A',
              from_date: '2026-11-08',
              to_date: '2026-11-10', // 15 existing + 20 moved = 35 > 30
              estimated_minutes: 20,
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
      } satisfies Partial<AppError>);
    });

    it('respects the milestone target_date when in the future, and uses the full 7-day window when target_date has already passed (#7 / #15 rule)', async () => {
      const echo = createEchoChatClient();

      // 1. Target date is 2026-11-12 (within 7 days of 2026-11-10) -> window ends at 2026-11-12
      const soonMilestone: Milestone = {
        ...currentMilestone,
        target_date: '2026-11-12',
      };
      const soonRepo = buildQuestRepo({
        milestone: soonMilestone,
        initialQuests: [
          {
            id: 1,
            milestone_id: soonMilestone.id,
            title: 'Earlier quest 1',
            due_date: '2026-11-08',
            estimated_minutes: 15,
            completed_at: null,
          },
        ],
      });
      const soonService = createQuestService({
        quests: soonRepo,
        progress: buildProgress(),
        ai: echo,
        clock,
      });

      const soonProposal = await soonService.proposeReschedule(1, { local_date: '2026-11-10' });
      expect(soonProposal.window_start).toBe('2026-11-10');
      expect(soonProposal.window_end).toBe('2026-11-12');
      for (const m of soonProposal.moves) {
        expect(m.to_date >= '2026-11-10' && m.to_date <= '2026-11-12').toBe(true);
      }

      // 2. Target date has already passed (2026-11-05 < 2026-11-10) -> full 7-day window 2026-11-10..2026-11-16
      const passedMilestone: Milestone = {
        ...currentMilestone,
        target_date: '2026-11-05',
      };
      const passedRepo = buildQuestRepo({
        milestone: passedMilestone,
        initialQuests: [
          {
            id: 1,
            milestone_id: passedMilestone.id,
            title: 'Earlier quest A',
            due_date: '2026-11-03',
            estimated_minutes: 25,
            completed_at: null,
          },
          {
            id: 2,
            milestone_id: passedMilestone.id,
            title: 'Earlier quest B',
            due_date: '2026-11-04',
            estimated_minutes: 25,
            completed_at: null,
          },
        ],
      });
      const passedService = createQuestService({
        quests: passedRepo,
        progress: buildProgress(),
        ai: echo,
        clock,
      });

      const passedProposal = await passedService.proposeReschedule(1, {
        local_date: '2026-11-10',
      });
      expect(passedProposal.window_start).toBe('2026-11-10');
      expect(passedProposal.window_end).toBe('2026-11-16');
      expect(passedProposal.moves).toHaveLength(2);
    });

    it('allows a partial reschedule when overdue quests exceed the available capacity in the window, leaving the rest unchanged and mentioning it kindly without guilt words', async () => {
      // Milestone target_date is 2026-11-11 (2-day window: 2026-11-10 and 2026-11-11, budget 25 min/day = 50 min total capacity)
      const tightMilestone: Milestone = {
        ...currentMilestone,
        target_date: '2026-11-11',
      };
      const questsRepo = buildQuestRepo({
        milestone: tightMilestone,
        initialQuests: [
          {
            id: 1,
            milestone_id: tightMilestone.id,
            title: 'Earlier quest 1 (20m)',
            due_date: '2026-11-06',
            estimated_minutes: 20,
            completed_at: null,
          },
          {
            id: 2,
            milestone_id: tightMilestone.id,
            title: 'Earlier quest 2 (20m)',
            due_date: '2026-11-07',
            estimated_minutes: 20,
            completed_at: null,
          },
          {
            id: 3,
            milestone_id: tightMilestone.id,
            title: 'Earlier quest 3 (20m — exceeds 2-day capacity)',
            due_date: '2026-11-08',
            estimated_minutes: 20,
            completed_at: null,
          },
        ],
      });

      const echo = createEchoChatClient();
      const service = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: echo,
        clock,
      });

      const proposal = await service.proposeReschedule(1, { local_date: '2026-11-10' });
      expect(proposal.overdue_quests).toHaveLength(3);
      // Only 2 of the 20m quests fit in the 2-day 25m/day window
      expect(proposal.moves).toHaveLength(2);
      expect(proposal.moves.map((m) => m.quest_id)).toEqual([1, 2]);
      expect(proposal.mochi_message.content).not.toMatch(GUILT_WORDS_REGEX);

      const confirmed = await service.confirmReschedule(1, {
        local_date: '2026-11-10',
        moves: proposal.moves,
      });

      // Quest 1 and 2 were moved; Quest 3 was left unchanged at 2026-11-08
      expect(confirmed.quests.find((q) => q.id === 1)?.due_date).toBe('2026-11-10');
      expect(confirmed.quests.find((q) => q.id === 2)?.due_date).toBe('2026-11-11');
      expect(confirmed.quests.find((q) => q.id === 3)?.due_date).toBe('2026-11-08');
    });

    it('rejects a stale or completed quest on confirm, rejects a double confirm, and does not change check-off, stamps, completed_local_date, or XP', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'Earlier quest to move',
            due_date: '2026-11-08',
            estimated_minutes: 15,
            completed_at: null,
          },
          {
            id: 2,
            milestone_id: currentMilestone.id,
            title: 'Already completed quest',
            due_date: '2026-11-09',
            estimated_minutes: 10,
            completed_at: '2026-11-09T18:00:00Z',
          },
        ],
      });
      const progress = buildProgress(20, [{ card_number: 1, stamp_date: '2026-11-09' }]);
      const echo = createEchoChatClient();
      const service = createQuestService({
        quests: questsRepo,
        progress,
        ai: echo,
        clock,
      });

      const proposal = await service.proposeReschedule(1, { local_date: '2026-11-10' });
      expect(proposal.moves).toHaveLength(1);

      // 1. Confirm succeeds and updates only due_date
      const confirmed = await service.confirmReschedule(1, {
        local_date: '2026-11-10',
        moves: proposal.moves,
      });
      expect(confirmed.quests.find((q) => q.id === 1)?.due_date).toBe('2026-11-10');
      expect(confirmed.quests.find((q) => q.id === 1)?.completed_at).toBeNull();
      expect(confirmed.quests.find((q) => q.id === 2)?.completed_at).toBe('2026-11-09T18:00:00Z');
      expect(progress.xp).toBe(20);
      expect(progress.stamps).toEqual([{ card_number: 1, stamp_date: '2026-11-09' }]);

      // 2. Double confirm of the same moves is rejected because quest 1 is no longer at from_date
      await expect(
        service.confirmReschedule(1, {
          local_date: '2026-11-10',
          moves: proposal.moves,
        }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        status: 409,
      } satisfies Partial<AppError>);

      // 3. If a quest is completed after preview and before confirm, confirm rejects it
      questsRepo.savedRows[0].due_date = '2026-11-08';
      const secondProposal = await service.proposeReschedule(1, { local_date: '2026-11-10' });
      questsRepo.savedRows[0].completed_at = '2026-11-10T15:00:00Z';

      await expect(
        service.confirmReschedule(1, {
          local_date: '2026-11-10',
          moves: secondProposal.moves,
        }),
      ).rejects.toMatchObject({
        status: 409,
      } satisfies Partial<AppError>);
    });

    it('rejects another user’s quests and ensures echo client messages never contain guilt words', async () => {
      const questsRepo = buildQuestRepo({
        initialQuests: [
          {
            id: 1,
            milestone_id: currentMilestone.id,
            title: 'User 1 past quest',
            due_date: '2026-11-08',
            estimated_minutes: 15,
            completed_at: null,
          },
        ],
      });
      const echo = createEchoChatClient();
      const service = createQuestService({
        quests: questsRepo,
        progress: buildProgress(),
        ai: echo,
        clock,
      });

      // User 2 cannot propose or confirm for User 1's quests
      await expect(service.proposeReschedule(2, { local_date: '2026-11-10' })).rejects.toMatchObject(
        {
          code: 'NOT_FOUND',
          status: 404,
        } satisfies Partial<AppError>,
      );

      await expect(
        service.confirmReschedule(2, {
          local_date: '2026-11-10',
          moves: [
            {
              quest_id: 1,
              title: 'User 1 past quest',
              from_date: '2026-11-08',
              to_date: '2026-11-10',
              estimated_minutes: 15,
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      } satisfies Partial<AppError>);

      // Echo client messages contain no guilt words across initial proposal, feedback adjustment, and partial reschedule
      const initialRes = await echo.proposeReschedule!({
        goal: activeGoal,
        milestone: currentMilestone,
        windowStart: '2026-11-10',
        windowEnd: '2026-11-16',
        timeBudgetMinutesPerDay: 25,
        overdueQuests: questsRepo.savedRows,
        existingQuests: questsRepo.savedRows,
      });
      expect(initialRes.mochi_message).not.toMatch(GUILT_WORDS_REGEX);

      const adjustedRes = await echo.proposeReschedule!({
        goal: activeGoal,
        milestone: currentMilestone,
        windowStart: '2026-11-10',
        windowEnd: '2026-11-16',
        timeBudgetMinutesPerDay: 25,
        overdueQuests: questsRepo.savedRows,
        existingQuests: questsRepo.savedRows,
        current_draft: initialRes.moves,
        feedback: 'Move it a day later please',
      });
      expect(adjustedRes.mochi_message).not.toMatch(GUILT_WORDS_REGEX);
    });
  });
});
