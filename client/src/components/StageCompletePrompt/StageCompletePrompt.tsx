import { MochiAvatar } from '../MochiAvatar';

export type StageCompletePromptProps = {
  milestoneTitle: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
};

/**
 * Green gel CTA when every quest on the current stage is done (Issue #10).
 * Confirm-before-save — does not advance until the user taps.
 */
export function StageCompletePrompt({
  milestoneTitle,
  busy = false,
  error = null,
  onConfirm,
}: StageCompletePromptProps) {
  return (
    <section
      className="mt-4 w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-tree bg-meadow/80 shadow-window animate-rise-in motion-reduce:animate-none"
      aria-label="Stage ready to complete"
      data-testid="stage-complete-prompt"
    >
      <header className="flex items-center justify-between gap-3 bg-gel-green px-4 py-[0.7rem] font-display text-[1.05rem] tracking-[0.01em] text-ink">
        <span className="inline-flex items-center gap-1.5">★ Stage cleared?</span>
        <span className="inline-flex gap-1 text-[0.85rem] opacity-90" aria-hidden="true">
          ♡ ♡
        </span>
      </header>
      <div className="grid grid-cols-1 gap-4 px-[1.15rem] pb-5 pt-[1.1rem] sm:grid-cols-[auto_1fr]">
        <div className="w-20 justify-self-center self-start rounded-lg bg-panel p-[0.4rem] pb-[0.9rem] shadow-polaroid -rotate-1 sm:justify-self-auto [&>svg]:block [&>svg]:h-auto [&>svg]:w-full">
          <MochiAvatar mood="cheer" />
        </div>
        <div className="min-w-0">
          <p className="mb-3 font-bold leading-[1.45] text-blue-ink">
            Every quest on <strong>{milestoneTitle}</strong> is done. Want to mark this stage
            complete and hop to the next one?
          </p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-pill bg-gel-green px-4 py-2 text-[0.88rem] font-bold text-ink shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
            data-testid="stage-complete-cta"
          >
            {busy ? 'Marking stage…' : '★ Mark stage complete'}
          </button>
          {error ? (
            <p className="mt-2 text-[0.9rem] text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
