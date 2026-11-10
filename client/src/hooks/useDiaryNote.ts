import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiaryNoteResponse } from '@questline/shared';
import { fetchDiaryNote, saveDiaryNote } from '../api/diaryNotes';

const AUTOSAVE_MS = 500;

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type UseDiaryNoteOptions = {
  /** When the active goal changes, reload that goal's note for today. */
  activeGoalId?: number | null;
  /** Override local date (tests). Defaults to the browser's local calendar day. */
  localDate?: string;
  /** Debounce window for autosave. */
  debounceMs?: number;
};

export function useDiaryNote(options: UseDiaryNoteOptions = {}) {
  const localDate = options.localDate ?? todayLocalDate();
  const debounceMs = options.debounceMs ?? AUTOSAVE_MS;
  const activeGoalId = options.activeGoalId ?? null;

  const [note, setNote] = useState<DiaryNoteResponse | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftRef = useRef(draft);
  const noteRef = useRef(note);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeq = useRef(0);

  draftRef.current = draft;
  noteRef.current = note;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reload = useCallback(async () => {
    clearTimer();
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const payload = await fetchDiaryNote(localDate);
      setNote(payload);
      setDraft(payload.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load diary note');
    } finally {
      setLoading(false);
    }
  }, [clearTimer, localDate]);

  useEffect(() => {
    void reload();
  }, [reload, activeGoalId]);

  const persist = useCallback(
    async (content: string) => {
      const seq = ++saveSeq.current;
      setSaving(true);
      setError(null);
      setSaved(false);
      try {
        const payload = await saveDiaryNote(content, localDate);
        if (seq !== saveSeq.current) return;
        setNote(payload);
        setSaved(true);
      } catch (err) {
        if (seq !== saveSeq.current) return;
        setError(err instanceof Error ? err.message : 'Could not save diary note');
      } finally {
        if (seq === saveSeq.current) {
          setSaving(false);
        }
      }
    },
    [localDate],
  );

  const flush = useCallback(async () => {
    clearTimer();
    const content = draftRef.current;
    const current = noteRef.current;
    if (current && content === current.content) {
      return;
    }
    await persist(content);
  }, [clearTimer, persist]);

  const setContent = useCallback(
    (next: string) => {
      setDraft(next);
      setSaved(false);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void persist(next);
      }, debounceMs);
    },
    [clearTimer, debounceMs, persist],
  );

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    note,
    content: draft,
    loading,
    saving,
    saved,
    error,
    setContent,
    flush,
    reload,
  };
}
