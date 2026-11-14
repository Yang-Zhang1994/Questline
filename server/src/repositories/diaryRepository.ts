import type { DiaryNote } from '@questline/shared';
import { toIsoDateTime } from '../clock.js';
import type { Db } from '../db/connection.js';

type DiaryNoteRow = {
  id: number;
  goal_id: number;
  note_date: string;
  content: string;
  updated_at: Date | string;
};

function mapUpdatedAt(value: Date | string): string {
  if (value instanceof Date) return toIsoDateTime(value);
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return value;
  return toIsoDateTime(asDate);
}

function mapDiaryNote(row: DiaryNoteRow): DiaryNote {
  return {
    id: row.id,
    goal_id: row.goal_id,
    note_date: row.note_date,
    content: row.content,
    updated_at: mapUpdatedAt(row.updated_at),
  };
}

const DIARY_NOTE_COLUMNS = `id, goal_id, note_date, content, updated_at`;

export function createDiaryRepository(db: Db) {
  return {
    async findByGoalAndDate(goalId: number, noteDate: string): Promise<DiaryNote | null> {
      const result = await db.query<DiaryNoteRow>(
        `SELECT ${DIARY_NOTE_COLUMNS}
         FROM diary_notes
         WHERE goal_id = $1 AND note_date = $2
         LIMIT 1`,
        [goalId, noteDate],
      );
      const row = result.rows[0];
      return row ? mapDiaryNote(row) : null;
    },

    async upsert(
      goalId: number,
      noteDate: string,
      content: string,
      updatedAt: string,
    ): Promise<DiaryNote> {
      const result = await db.query<DiaryNoteRow>(
        `INSERT INTO diary_notes (goal_id, note_date, content, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (goal_id, note_date)
         DO UPDATE SET
           content = EXCLUDED.content,
           updated_at = EXCLUDED.updated_at
         RETURNING ${DIARY_NOTE_COLUMNS}`,
        [goalId, noteDate, content, updatedAt],
      );
      return mapDiaryNote(result.rows[0]);
    },
  };
}

export type DiaryRepository = ReturnType<typeof createDiaryRepository>;
