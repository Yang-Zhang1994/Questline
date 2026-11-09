import type {
  Milestone,
  MilestoneGoalSummary,
  MilestoneStatus,
  Quest,
  QuestPlanDraft,
  RescheduleDraft,
  StampCard,
  UserProgress,
} from '@questline/shared';
import { toIsoDateTime } from '../clock.js';
import {
  applyActiveDay,
  levelFromTotalXp,
  progressSnapshotFromXp,
  revertActiveDay,
  type StreakState,
} from '../config/game.js';
import type { Db } from '../db/connection.js';
import { createStampRepository } from './stampRepository.js';

type QuestRow = {
  id: number;
  milestone_id: number;
  title: string;
  due_date: string;
  estimated_minutes: number | null;
  completed_at: Date | string | null;
};

type GoalRow = {
  id: number;
  title: string;
  done_definition: string | null;
  starting_point: string | null;
  time_budget_minutes_per_day: number | null;
  deadline: string | null;
  reschedule_draft?: RescheduleDraft | string | null;
};

type MilestoneRow = {
  id: number;
  goal_id: number;
  position: number;
  title: string;
  description: string | null;
  target_date: string | null;
  status: MilestoneStatus;
  quest_draft: QuestPlanDraft | string | null;
};

function mapCompletedAt(value: Date | string | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) return toIsoDateTime(value);
  // pg may return timestamptz as string depending on parsers
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return value;
  return toIsoDateTime(asDate);
}

function mapQuest(row: QuestRow): Quest {
  return {
    id: row.id,
    milestone_id: row.milestone_id,
    title: row.title,
    due_date: row.due_date,
    estimated_minutes: row.estimated_minutes,
    completed_at: mapCompletedAt(row.completed_at),
  };
}

function mapGoalSummary(row: GoalRow): MilestoneGoalSummary {
  return {
    id: row.id,
    title: row.title,
    done_definition: row.done_definition,
    starting_point: row.starting_point,
    time_budget_minutes_per_day: row.time_budget_minutes_per_day,
    deadline: row.deadline,
  };
}

function parseQuestDraft(raw: MilestoneRow['quest_draft']): QuestPlanDraft | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as QuestPlanDraft;
    } catch {
      return null;
    }
  }
  return raw;
}

function parseRescheduleDraft(
  raw: GoalRow['reschedule_draft'],
): RescheduleDraft | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as RescheduleDraft;
    } catch {
      return null;
    }
  }
  return raw;
}

export type RescheduleContext = {
  goal: MilestoneGoalSummary;
  milestone: Milestone;
  draft: RescheduleDraft | null;
  overdue: Quest[];
  /** All quests on the active goal (for day-load + confirm). */
  allQuests: Quest[];
};

function mapMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    goal_id: row.goal_id,
    position: row.position,
    title: row.title,
    description: row.description,
    target_date: row.target_date,
    status: row.status,
  };
}

export type TodayQuestContext = {
  goalTitle: string | null;
  milestoneTitle: string | null;
  quests: Quest[];
};

export type CurrentMilestoneQuestContext = {
  goal: MilestoneGoalSummary;
  milestone: Milestone;
  draft: QuestPlanDraft | null;
  quests: Quest[];
};

export function createQuestRepository(db: Db) {
  return {
    async findByIdForUser(userId: number, id: number): Promise<Quest | null> {
      const result = await db.query<QuestRow>(
        `SELECT q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at
         FROM quests q
         INNER JOIN milestones m ON m.id = q.milestone_id
         INNER JOIN goals g ON g.id = m.goal_id
         WHERE q.id = $1 AND g.user_id = $2`,
        [id, userId],
      );
      const row = result.rows[0];
      return row ? mapQuest(row) : null;
    },

    async listDueOnDateForActiveGoal(userId: number, localDate: string): Promise<TodayQuestContext> {
      const goalResult = await db.query<{ id: number; title: string }>(
        `SELECT id, title FROM goals
         WHERE user_id = $1 AND status = 'active'
         ORDER BY id LIMIT 1`,
        [userId],
      );
      const goal = goalResult.rows[0];

      if (!goal) {
        return { goalTitle: null, milestoneTitle: null, quests: [] };
      }

      const milestoneResult = await db.query<{ id: number; title: string }>(
        `SELECT id, title FROM milestones
         WHERE goal_id = $1 AND status = 'current'
         ORDER BY position LIMIT 1`,
        [goal.id],
      );
      const milestone = milestoneResult.rows[0];

      const questResult = await db.query<QuestRow>(
        `SELECT q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at
         FROM quests q
         INNER JOIN milestones m ON m.id = q.milestone_id
         WHERE m.goal_id = $1 AND q.due_date = $2
         ORDER BY q.id ASC`,
        [goal.id, localDate],
      );

      return {
        goalTitle: goal.title,
        milestoneTitle: milestone?.title ?? null,
        quests: questResult.rows.map(mapQuest),
      };
    },

    /** Incomplete quests with due_date before localDate on the active goal (#14). */
    async listOverdueForActiveGoal(userId: number, localDate: string): Promise<Quest[]> {
      const result = await db.query<QuestRow>(
        `SELECT q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at
         FROM quests q
         INNER JOIN milestones m ON m.id = q.milestone_id
         INNER JOIN goals g ON g.id = m.goal_id
         WHERE g.user_id = $1
           AND g.status = 'active'
           AND q.completed_at IS NULL
           AND q.due_date < $2
         ORDER BY q.due_date ASC, q.id ASC`,
        [userId, localDate],
      );
      return result.rows.map(mapQuest);
    },

    /** Active goal + current milestone + overdue + reschedule draft (#14). */
    async findRescheduleContext(
      userId: number,
      localDate: string,
    ): Promise<RescheduleContext | null> {
      const goalResult = await db.query<GoalRow>(
        `SELECT id, title, done_definition, starting_point,
                time_budget_minutes_per_day, deadline, reschedule_draft
         FROM goals
         WHERE user_id = $1 AND status = 'active'
         LIMIT 1`,
        [userId],
      );
      const goalRow = goalResult.rows[0];
      if (!goalRow) return null;

      const milestoneResult = await db.query<MilestoneRow>(
        `SELECT id, goal_id, position, title, description, target_date, status, quest_draft
         FROM milestones
         WHERE goal_id = $1 AND status = 'current'
         ORDER BY position ASC
         LIMIT 1`,
        [goalRow.id],
      );
      const milestoneRow = milestoneResult.rows[0];
      if (!milestoneRow) return null;

      const questResult = await db.query<QuestRow>(
        `SELECT q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at
         FROM quests q
         INNER JOIN milestones m ON m.id = q.milestone_id
         WHERE m.goal_id = $1
         ORDER BY q.due_date ASC, q.id ASC`,
        [goalRow.id],
      );
      const allQuests = questResult.rows.map(mapQuest);
      const overdue = allQuests.filter(
        (q) => q.completed_at === null && q.due_date < localDate,
      );

      return {
        goal: mapGoalSummary(goalRow),
        milestone: mapMilestone(milestoneRow),
        draft: parseRescheduleDraft(goalRow.reschedule_draft),
        overdue,
        allQuests,
      };
    },

    async saveRescheduleDraft(
      goalId: number,
      userId: number,
      draft: RescheduleDraft | null,
    ): Promise<void> {
      const result = await db.query(
        `UPDATE goals
         SET reschedule_draft = $1::jsonb
         WHERE id = $2 AND user_id = $3 AND status = 'active'`,
        [draft ? JSON.stringify(draft) : null, goalId, userId],
      );
      if (result.rowCount !== 1) {
        throw new Error('Active goal not found while saving reschedule draft');
      }
    },

    /**
     * Confirm-before-save: UPDATE due_date for existing overdue quests only.
     * Never INSERTs quests (no duplicates). Clears the draft.
     */
    async applyRescheduleDraft(
      goalId: number,
      userId: number,
      draft: RescheduleDraft,
    ): Promise<Quest[]> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const owned = await client.query<{ id: number }>(
          `SELECT id FROM goals
           WHERE id = $1 AND user_id = $2 AND status = 'active'
           FOR UPDATE`,
          [goalId, userId],
        );
        if (!owned.rows[0]) {
          throw new Error('Active goal not found while confirming reschedule');
        }

        const updated: Quest[] = [];
        for (const move of draft.moves) {
          const result = await client.query<QuestRow>(
            `UPDATE quests q
             SET due_date = $1
             FROM milestones m
             INNER JOIN goals g ON g.id = m.goal_id
             WHERE q.id = $2
               AND q.milestone_id = m.id
               AND g.id = $3
               AND g.user_id = $4
               AND q.completed_at IS NULL
             RETURNING q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at`,
            [move.to_date, move.quest_id, goalId, userId],
          );
          if (result.rows[0]) {
            updated.push(mapQuest(result.rows[0]));
          }
        }

        await client.query(`UPDATE goals SET reschedule_draft = NULL WHERE id = $1`, [
          goalId,
        ]);
        await client.query('COMMIT');
        return updated;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async setCompletedAtForUser(
      userId: number,
      id: number,
      completedAt: string | null,
    ): Promise<Quest | null> {
      const result = await db.query<QuestRow>(
        `UPDATE quests q
         SET completed_at = $1
         FROM milestones m
         INNER JOIN goals g ON g.id = m.goal_id
         WHERE q.id = $2
           AND q.milestone_id = m.id
           AND g.user_id = $3
         RETURNING q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at`,
        [completedAt, id, userId],
      );
      const row = result.rows[0];
      return row ? mapQuest(row) : null;
    },

    /**
     * Complete or undo a quest and adjust XP + streak + stamps in one transaction
     * (#11 / #12 / #13). Caller must only invoke when the completion state changes.
     * `localDate` is the user's local YYYY-MM-DD (never server "today").
     */
    async setCompletionWithXp(
      userId: number,
      id: number,
      completedAt: string | null,
      xpDelta: number,
      localDate: string,
    ): Promise<{
      quest: Quest;
      progress: UserProgress;
      previousLevel: number;
      stamp_card: StampCard;
      card_completed: boolean;
      completed_card_number: number | null;
    } | null> {
      const client = await db.connect();
      const stamps = createStampRepository(db);
      try {
        await client.query('BEGIN');

        const owned = await client.query<QuestRow>(
          `SELECT q.id, q.milestone_id, q.title, q.due_date, q.estimated_minutes, q.completed_at
           FROM quests q
           INNER JOIN milestones m ON m.id = q.milestone_id
           INNER JOIN goals g ON g.id = m.goal_id
           WHERE q.id = $1 AND g.user_id = $2
           FOR UPDATE OF q`,
          [id, userId],
        );
        if (!owned.rows[0]) {
          await client.query('ROLLBACK');
          return null;
        }

        const updated = await client.query<QuestRow>(
          `UPDATE quests
           SET completed_at = $1
           WHERE id = $2
           RETURNING id, milestone_id, title, due_date, estimated_minutes, completed_at`,
          [completedAt, id],
        );

        const progressRow = await client.query<{
          xp: number;
          level: number;
          current_streak: number;
          best_streak: number;
          last_active_date: string | null;
          active_day_completions: number;
        }>(
          `INSERT INTO user_progress (
             user_id, xp, level, current_streak, best_streak, last_active_date, active_day_completions
           )
           VALUES ($1, 0, 1, 0, 0, NULL, 0)
           ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
           RETURNING xp, level, current_streak, best_streak, last_active_date, active_day_completions`,
          [userId],
        );
        const previousLevel = progressRow.rows[0].level;
        const previousXp = progressRow.rows[0].xp;
        const nextXp = Math.max(0, previousXp + xpDelta);
        const nextLevel = levelFromTotalXp(nextXp);

        let streak: StreakState = {
          current_streak: progressRow.rows[0].current_streak,
          best_streak: progressRow.rows[0].best_streak,
          last_active_date: progressRow.rows[0].last_active_date,
        };
        let activeDayCompletions = progressRow.rows[0].active_day_completions;
        let firstActiveDay = false;
        let clearActiveDay = false;

        if (xpDelta > 0) {
          // Completing — first active quest of the local day bumps streak + stamp.
          if (streak.last_active_date === localDate) {
            activeDayCompletions += 1;
          } else {
            streak = applyActiveDay(streak, localDate);
            activeDayCompletions = 1;
            firstActiveDay = true;
          }
        } else if (streak.last_active_date === localDate) {
          // Undo — reverse streak/stamp only when this was the last completion that day.
          activeDayCompletions = Math.max(0, activeDayCompletions - 1);
          if (activeDayCompletions === 0) {
            streak = revertActiveDay(streak, localDate);
            clearActiveDay = true;
          }
        }

        await client.query(
          `UPDATE user_progress
           SET xp = $1, level = $2,
               current_streak = $3, best_streak = $4, last_active_date = $5,
               active_day_completions = $6
           WHERE user_id = $7`,
          [
            nextXp,
            nextLevel,
            streak.current_streak,
            streak.best_streak,
            streak.last_active_date,
            activeDayCompletions,
            userId,
          ],
        );

        let stamp_card: StampCard;
        let card_completed = false;
        let completed_card_number: number | null = null;

        if (firstActiveDay) {
          const stampResult = await stamps.addStampForDay(userId, localDate, client);
          stamp_card = stampResult.stamp_card;
          card_completed = stampResult.card_completed;
          completed_card_number = stampResult.completed_card_number;
        } else if (clearActiveDay) {
          stamp_card = await stamps.removeStampForDay(userId, localDate, client);
        } else {
          stamp_card = await stamps.getCardState(userId, client);
        }

        await client.query('COMMIT');
        return {
          quest: mapQuest(updated.rows[0]),
          progress: progressSnapshotFromXp(nextXp, streak),
          previousLevel,
          stamp_card,
          card_completed,
          completed_card_number,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    /** Active goal + current milestone + draft/saved quests (Issue #7). */
    async findCurrentMilestoneQuestContext(
      userId: number,
    ): Promise<CurrentMilestoneQuestContext | null> {
      const goalResult = await db.query<GoalRow>(
        `SELECT id, title, done_definition, starting_point,
                time_budget_minutes_per_day, deadline
         FROM goals
         WHERE user_id = $1 AND status = 'active'
         LIMIT 1`,
        [userId],
      );
      const goalRow = goalResult.rows[0];
      if (!goalRow) return null;

      const milestoneResult = await db.query<MilestoneRow>(
        `SELECT id, goal_id, position, title, description, target_date, status, quest_draft
         FROM milestones
         WHERE goal_id = $1 AND status = 'current'
         ORDER BY position ASC
         LIMIT 1`,
        [goalRow.id],
      );
      const milestoneRow = milestoneResult.rows[0];
      if (!milestoneRow) return null;

      const questResult = await db.query<QuestRow>(
        `SELECT id, milestone_id, title, due_date, estimated_minutes, completed_at
         FROM quests
         WHERE milestone_id = $1
         ORDER BY due_date ASC, id ASC`,
        [milestoneRow.id],
      );

      return {
        goal: mapGoalSummary(goalRow),
        milestone: mapMilestone(milestoneRow),
        draft: parseQuestDraft(milestoneRow.quest_draft),
        quests: questResult.rows.map(mapQuest),
      };
    },

    async saveQuestDraft(
      milestoneId: number,
      userId: number,
      draft: QuestPlanDraft | null,
    ): Promise<void> {
      const result = await db.query(
        `UPDATE milestones m
         SET quest_draft = $1::jsonb
         FROM goals g
         WHERE m.id = $2
           AND m.goal_id = g.id
           AND g.user_id = $3
           AND g.status = 'active'
           AND m.status = 'current'`,
        [draft ? JSON.stringify(draft) : null, milestoneId, userId],
      );
      if (result.rowCount !== 1) {
        throw new Error('Current milestone not found while saving quest draft');
      }
    },

    /**
     * Confirm-before-save: replace quests for the current milestone and clear the draft.
     * Only writes quests for the authenticated user's current milestone.
     */
    async confirmQuestPlan(
      milestoneId: number,
      userId: number,
      draft: QuestPlanDraft,
    ): Promise<Quest[]> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const owned = await client.query<MilestoneRow>(
          `SELECT m.id, m.goal_id, m.position, m.title, m.description, m.target_date, m.status, m.quest_draft
           FROM milestones m
           INNER JOIN goals g ON g.id = m.goal_id
           WHERE m.id = $1
             AND g.user_id = $2
             AND g.status = 'active'
             AND m.status = 'current'
           FOR UPDATE OF m`,
          [milestoneId, userId],
        );
        if (!owned.rows[0]) {
          throw new Error('Current milestone not found while confirming quest plan');
        }

        await client.query(`DELETE FROM quests WHERE milestone_id = $1`, [milestoneId]);

        const saved: Quest[] = [];
        for (const item of draft.quests) {
          const inserted = await client.query<QuestRow>(
            `INSERT INTO quests (milestone_id, title, due_date, estimated_minutes, completed_at)
             VALUES ($1, $2, $3, $4, NULL)
             RETURNING id, milestone_id, title, due_date, estimated_minutes, completed_at`,
            [milestoneId, item.title, item.due_date, item.estimated_minutes],
          );
          saved.push(mapQuest(inserted.rows[0]));
        }

        await client.query(
          `UPDATE milestones SET quest_draft = NULL WHERE id = $1`,
          [milestoneId],
        );

        await client.query('COMMIT');
        return saved;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

export type QuestRepository = ReturnType<typeof createQuestRepository>;
