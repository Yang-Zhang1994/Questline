import {
  INTERVIEW_TOPICS,
  type InterviewAnswers,
  type InterviewState,
  type InterviewStatus,
  type InterviewTopic,
} from '@questline/shared';
import { toIsoDateTime } from '../clock.js';
import type { Db } from '../db/connection.js';

type InterviewRow = {
  id: number;
  user_id: number;
  status: InterviewStatus;
  current_topic: InterviewTopic;
  done_definition: string | null;
  starting_point: string | null;
  time_budget: string | null;
  deadline: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type InterviewRecord = {
  id: number;
  user_id: number;
  status: InterviewStatus;
  current_topic: InterviewTopic;
  answers: InterviewAnswers;
  created_at: string;
  updated_at: string;
};

function mapCreatedAt(value: Date | string): string {
  if (value instanceof Date) return toIsoDateTime(value);
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return value;
  return toIsoDateTime(asDate);
}

function answersFromRow(row: InterviewRow): InterviewAnswers {
  return {
    done_definition: row.done_definition,
    starting_point: row.starting_point,
    time_budget: row.time_budget,
    deadline: row.deadline,
  };
}

function mapRecord(row: InterviewRow): InterviewRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    status: row.status,
    current_topic: row.current_topic,
    answers: answersFromRow(row),
    created_at: mapCreatedAt(row.created_at),
    updated_at: mapCreatedAt(row.updated_at),
  };
}

export function toInterviewState(record: InterviewRecord): InterviewState {
  const answered_topics = INTERVIEW_TOPICS.filter((topic) => {
    const value = record.answers[topic];
    return typeof value === 'string' && value.trim().length > 0;
  });

  return {
    status: record.status,
    current_topic: record.status === 'complete' ? null : record.current_topic,
    answered_topics,
    answers: record.answers,
  };
}

export function createInterviewRepository(db: Db) {
  return {
    async getForUser(userId: number): Promise<InterviewRecord | null> {
      const result = await db.query<InterviewRow>(
        `SELECT id, user_id, status, current_topic,
                done_definition, starting_point, time_budget, deadline,
                created_at, updated_at
         FROM goal_interviews
         WHERE user_id = $1`,
        [userId],
      );
      const row = result.rows[0];
      return row ? mapRecord(row) : null;
    },

    async ensureForUser(userId: number): Promise<InterviewRecord> {
      const existing = await this.getForUser(userId);
      if (existing) return existing;

      const result = await db.query<InterviewRow>(
        `INSERT INTO goal_interviews (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING id, user_id, status, current_topic,
                   done_definition, starting_point, time_budget, deadline,
                   created_at, updated_at`,
        [userId],
      );
      return mapRecord(result.rows[0]);
    },

    async saveProgress(
      userId: number,
      patch: {
        status: InterviewStatus;
        current_topic: InterviewTopic;
        answers: InterviewAnswers;
        updatedAt: string;
      },
    ): Promise<InterviewRecord> {
      const result = await db.query<InterviewRow>(
        `UPDATE goal_interviews
         SET status = $2,
             current_topic = $3,
             done_definition = $4,
             starting_point = $5,
             time_budget = $6,
             deadline = $7,
             updated_at = $8
         WHERE user_id = $1
         RETURNING id, user_id, status, current_topic,
                   done_definition, starting_point, time_budget, deadline,
                   created_at, updated_at`,
        [
          userId,
          patch.status,
          patch.current_topic,
          patch.answers.done_definition,
          patch.answers.starting_point,
          patch.answers.time_budget,
          patch.answers.deadline,
          patch.updatedAt,
        ],
      );
      return mapRecord(result.rows[0]);
    },

    async resetForUser(userId: number, updatedAt: string): Promise<InterviewRecord> {
      await this.ensureForUser(userId);
      const result = await db.query<InterviewRow>(
        `UPDATE goal_interviews
         SET status = 'in_progress',
             current_topic = 'done_definition',
             done_definition = NULL,
             starting_point = NULL,
             time_budget = NULL,
             deadline = NULL,
             updated_at = $2
         WHERE user_id = $1
         RETURNING id, user_id, status, current_topic,
                   done_definition, starting_point, time_budget, deadline,
                   created_at, updated_at`,
        [userId, updatedAt],
      );
      return mapRecord(result.rows[0]);
    },
  };
}

export type InterviewRepository = ReturnType<typeof createInterviewRepository>;
