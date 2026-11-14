import { z } from 'zod';
import { IsoDateSchema, IsoDateTimeSchema } from './quest.js';

export const MAX_DIARY_NOTE_LENGTH = 2000;

export const DiaryNoteContentSchema = z
  .string()
  .max(
    MAX_DIARY_NOTE_LENGTH,
    `Diary note is too long (max ${MAX_DIARY_NOTE_LENGTH} characters)`,
  );

export const DiaryNoteSchema = z.object({
  id: z.number().int().positive().nullable(),
  goal_id: z.number().int().positive().nullable(),
  note_date: IsoDateSchema,
  content: DiaryNoteContentSchema,
  updated_at: IsoDateTimeSchema.nullable(),
});

export type DiaryNote = z.infer<typeof DiaryNoteSchema>;

export const UpsertDiaryNoteBodySchema = z.object({
  content: DiaryNoteContentSchema,
  local_date: IsoDateSchema.optional(),
});

export type UpsertDiaryNoteBody = z.infer<typeof UpsertDiaryNoteBodySchema>;
