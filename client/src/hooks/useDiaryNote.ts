import { useCallback, useEffect, useRef, useState } from 'react';
import { DiaryNoteContentSchema } from '@questline/shared';
import {
  FRIENDLY_DIARY_SAVE_ERROR,
  fetchDiaryNote,
  saveDiaryNote,
} from '../api/diary';

export const DIARY_AUTOSAVE_DELAY_MS = 1000;

export type DiarySaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type UseDiaryNoteOptions = {
  goalId: number | null;
  localDate: string | null;
  debounceMs?: number;
};

function toFriendlySaveError(err: unknown): string {
  if (!(err instanceof Error)) return FRIENDLY_DIARY_SAVE_ERROR;
  const trimmed = err.message.trim();
  if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return FRIENDLY_DIARY_SAVE_ERROR;
  }
  return trimmed;
}

export function useDiaryNote({
  goalId,
  localDate,
  debounceMs = DIARY_AUTOSAVE_DELAY_MS,
}: UseDiaryNoteOptions) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<DiarySaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const latestContentRef = useRef('');
  const lastSavedContentRef = useRef('');
  const inFlightContentRef = useRef<string | null>(null);
  const saveSeqRef = useRef(0);
  const userHasEditedRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearDebounceTimer();
    userHasEditedRef.current = false;
    latestContentRef.current = '';
    lastSavedContentRef.current = '';
    inFlightContentRef.current = null;
    saveSeqRef.current += 1;

    if (!goalId || !localDate) {
      setContent('');
      setLoading(false);
      setSaveStatus('idle');
      setSaveError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSaveStatus('idle');
    setSaveError(null);

    void (async () => {
      try {
        const note = await fetchDiaryNote(localDate);
        if (cancelled || userHasEditedRef.current) {
          return;
        }
        latestContentRef.current = note.content;
        lastSavedContentRef.current = note.content;
        setContent(note.content);
      } catch (err) {
        if (!cancelled) {
          console.error("Could not load today's diary note:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearDebounceTimer();
    };
  }, [goalId, localDate, clearDebounceTimer]);

  const performSave = useCallback(
    async (textToSave: string) => {
      if (!goalId || !localDate) return;

      clearDebounceTimer();

      const parsed = DiaryNoteContentSchema.safeParse(textToSave);
      if (!parsed.success) {
        saveSeqRef.current += 1;
        inFlightContentRef.current = null;
        setSaveStatus('error');
        setSaveError(parsed.error.issues[0]?.message ?? FRIENDLY_DIARY_SAVE_ERROR);
        return;
      }

      const seq = ++saveSeqRef.current;
      inFlightContentRef.current = parsed.data;
      setSaveStatus('saving');
      setSaveError(null);

      try {
        const saved = await saveDiaryNote(parsed.data, localDate);
        if (seq !== saveSeqRef.current) {
          return;
        }
        inFlightContentRef.current = null;
        lastSavedContentRef.current = saved.content;
        setSaveStatus('saved');
        setSaveError(null);
      } catch (err) {
        if (seq !== saveSeqRef.current) {
          return;
        }
        console.error('Could not save diary note:', err);
        inFlightContentRef.current = null;
        setSaveStatus('error');
        setSaveError(toFriendlySaveError(err));
      }
    },
    [goalId, localDate, clearDebounceTimer],
  );

  const updateContent = useCallback(
    (nextContent: string) => {
      userHasEditedRef.current = true;
      latestContentRef.current = nextContent;
      setContent(nextContent);
      clearDebounceTimer();

      const parsed = DiaryNoteContentSchema.safeParse(nextContent);
      if (!parsed.success) {
        saveSeqRef.current += 1;
        inFlightContentRef.current = null;
        setSaveStatus('error');
        setSaveError(parsed.error.issues[0]?.message ?? FRIENDLY_DIARY_SAVE_ERROR);
        return;
      }

      setSaveError(null);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void performSave(nextContent);
      }, debounceMs);
    },
    [clearDebounceTimer, debounceMs, performSave],
  );

  const flushSave = useCallback(() => {
    if (!goalId || !localDate) return;

    if (debounceTimerRef.current !== null) {
      clearDebounceTimer();
      void performSave(latestContentRef.current);
      return;
    }

    if (
      userHasEditedRef.current &&
      latestContentRef.current !== lastSavedContentRef.current &&
      inFlightContentRef.current !== latestContentRef.current
    ) {
      void performSave(latestContentRef.current);
    }
  }, [goalId, localDate, clearDebounceTimer, performSave]);

  return {
    content,
    loading,
    saveStatus,
    saveError,
    updateContent,
    flushSave,
  };
}
