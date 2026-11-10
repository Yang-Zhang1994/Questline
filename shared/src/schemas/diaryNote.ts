import { z } from 'zod';
import { IsoDateSchema, IsoDateTimeSchema } from './quest.js';

/** Soft cap so diary notes stay short reflections (#19). */
export const DIARY_NOTE_MAX_LENGTH = 2000;

/** Persisted diary note — one per goal per local calendar day (#19). */
export const DiaryNoteSchema = z.object({
  id: z.number().int().positive().nullable(),
  goal_id: z.number().int().positive().nullable(),
  note_date: IsoDateSchema,
  content: z.string().max(DIARY_NOTE_MAX_LENGTH),
  updated_at: IsoDateTimeSchema.nullable(),
});

export type DiaryNote = z.infer<typeof DiaryNoteSchema>;

export const DiaryNoteResponseSchema = DiaryNoteSchema;

export type DiaryNoteResponse = z.infer<typeof DiaryNoteResponseSchema>;

export const UpsertDiaryNoteBodySchema = z.object({
  content: z.string().max(DIARY_NOTE_MAX_LENGTH),
  local_date: IsoDateSchema.optional(),
});

export type UpsertDiaryNoteBody = z.infer<typeof UpsertDiaryNoteBodySchema>;
