import type { DiaryNote } from '@questline/shared';
import { toIsoDateTime, type Clock } from '../clock.js';
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

export type DiaryNoteRepository = ReturnType<typeof createDiaryNoteRepository>;

export function createDiaryNoteRepository(db: Db, clock: Clock) {
  return {
    async findByGoalAndDate(goalId: number, noteDate: string): Promise<DiaryNote | null> {
      const result = await db.query<DiaryNoteRow>(
        `SELECT id, goal_id, note_date, content, updated_at
         FROM diary_notes
         WHERE goal_id = $1 AND note_date = $2
         LIMIT 1`,
        [goalId, noteDate],
      );
      const row = result.rows[0];
      return row ? mapDiaryNote(row) : null;
    },

    /**
     * Upsert for (goal_id, note_date). Ownership is checked by the service
     * before calling — this repo only writes the known goal id.
     */
    async upsertForGoal(
      goalId: number,
      noteDate: string,
      content: string,
    ): Promise<DiaryNote> {
      const now = clock.now();
      const result = await db.query<DiaryNoteRow>(
        `INSERT INTO diary_notes (goal_id, note_date, content, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (goal_id, note_date)
         DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
         RETURNING id, goal_id, note_date, content, updated_at`,
        [goalId, noteDate, content, now],
      );
      const row = result.rows[0];
      if (!row) {
        throw new Error('DIARY_NOTE_UPSERT_FAILED');
      }
      return mapDiaryNote(row);
    },
  };
}
