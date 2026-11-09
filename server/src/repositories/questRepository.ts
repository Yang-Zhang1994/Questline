import type {
  Milestone,
  MilestoneGoalSummary,
  MilestoneStatus,
  Quest,
  QuestPlanDraft,
} from '@questline/shared';
import { toIsoDateTime } from '../clock.js';
import type { Db } from '../db/connection.js';

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
