import { MAX_DIARY_NOTE_LENGTH } from '@questline/shared';
import type { DiarySaveStatus } from '../../hooks/useDiaryNote';

export type DiaryNoteCardProps = {
  content: string;
  loading?: boolean;
  saveStatus: DiarySaveStatus;
  saveError?: string | null;
  onChange: (nextContent: string) => void;
  onBlur: () => void;
};

const TEXTAREA_ID = 'diary-note-textarea';

export function DiaryNoteCard({
  content,
  loading = false,
  saveStatus,
  saveError = null,
  onChange,
  onBlur,
}: DiaryNoteCardProps) {
  return (
    <section
      className="relative z-[1] w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink bg-pink-pale shadow-window animate-rise-in motion-reduce:animate-none"
      aria-label="Daily diary reflection"
      data-testid="diary-note-card"
    >
      <header className="flex items-center justify-between gap-3 bg-gel-pink px-4 py-[0.65rem] font-display text-[1rem] tracking-[0.01em] text-white">
        <label htmlFor={TEXTAREA_ID} className="cursor-pointer inline-flex items-center gap-1.5">
          <span aria-hidden="true">✦</span> Diary note for today
        </label>
        <span
          className="inline-flex items-center gap-2 font-body text-[0.8rem] font-bold"
          aria-live="polite"
          data-testid="diary-save-status"
        >
          {saveStatus === 'saving' ? (
            <span className="rounded-pill bg-white/25 px-2.5 py-0.5 text-white">Saving…</span>
          ) : null}
          {saveStatus === 'saved' ? (
            <span className="rounded-pill bg-white/25 px-2.5 py-0.5 text-white">Saved ♡</span>
          ) : null}
          {saveStatus === 'idle' && !loading ? (
            <span className="text-white/90" aria-hidden="true">
              ♡
            </span>
          ) : null}
        </span>
      </header>

      <div className="bg-note-lines px-5 py-4">
        <textarea
          id={TEXTAREA_ID}
          value={content}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          onBlur={onBlur}
          rows={3}
          maxLength={MAX_DIARY_NOTE_LENGTH}
          placeholder="Jot down a small thought or win from today… ♡"
          aria-describedby="diary-note-counter"
          className="w-full resize-y rounded-[14px] border-2 border-pink/35 bg-panel/95 px-3.5 py-2.5 font-body text-[0.95rem] leading-relaxed text-ink placeholder:text-ink-soft/70 shadow-sm focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink/40"
        />

        <div className="mt-2 flex items-center justify-between gap-2 text-[0.78rem] text-ink-soft">
          <span>Saves automatically as you type ♡</span>
          <span id="diary-note-counter" data-testid="diary-note-counter">
            {content.length} / {MAX_DIARY_NOTE_LENGTH}
          </span>
        </div>

        {saveStatus === 'error' && saveError ? (
          <div
            className="mt-2.5 rounded-[12px] border border-pink/40 bg-panel/95 px-3.5 py-2 text-left"
            role="alert"
            data-testid="diary-save-error"
          >
            <p className="m-0 text-[0.85rem] text-ink">{saveError}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
