export type DiaryNoteProps = {
  content: string;
  loading?: boolean;
  saving?: boolean;
  saved?: boolean;
  error?: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

/**
 * Daily reflection textarea for the active goal (#19).
 * Distinct from `DailyNote` (Mochi's quests window, #8/#9).
 */
export function DiaryNote({
  content,
  loading = false,
  saving = false,
  saved = false,
  error = null,
  disabled = false,
  onChange,
  onBlur,
}: DiaryNoteProps) {
  const status = (() => {
    if (error) return null;
    if (saving) return 'Saving…';
    if (saved) return 'Saved';
    if (loading) return 'Loading…';
    return 'Autosaves when you pause';
  })();

  return (
    <section
      className="mt-4 w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink/50 bg-white/85 shadow-window animate-rise-in"
      aria-label="Diary note for today"
      data-testid="diary-note"
    >
      <header className="flex items-center justify-between gap-3 bg-gel-pink px-4 py-[0.7rem] font-display text-[1.05rem] tracking-[0.01em] text-white">
        <span className="inline-flex items-center gap-1.5">✎ Diary note for today</span>
        <span className="inline-flex gap-1 text-[0.85rem] opacity-90" aria-hidden="true">
          ♡
        </span>
      </header>

      <div className="bg-note-lines px-[1.15rem] py-4">
        <label className="flex flex-col gap-1 text-[0.9rem] font-bold text-ink">
          Diary note for today
          <textarea
            name="diary-note"
            rows={4}
            value={content}
            disabled={disabled || loading}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              onBlur?.();
            }}
            placeholder="A soft note for yourself — how did today feel?"
            className="min-h-[6.5rem] resize-y rounded-lg border-2 border-pink/40 bg-panel px-3 py-2 font-normal leading-relaxed text-ink outline-none focus-visible:border-pink focus-visible:ring-2 focus-visible:ring-pink/40 disabled:opacity-70"
          />
        </label>

        {status ? (
          <p className="mt-2 text-[0.8rem] text-ink-soft" data-testid="diary-note-status" aria-live="polite">
            {status}
          </p>
        ) : null}

        {error ? (
          <p className="mt-2 text-[0.9rem] text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
