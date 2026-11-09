import { useState } from 'react';
import type {
  Milestone,
  MilestoneGoalSummary,
  RescheduleDraft,
} from '@questline/shared';

export type ReschedulePreviewProps = {
  draft: RescheduleDraft | null;
  goal?: MilestoneGoalSummary | null;
  milestone?: Milestone | null;
  loading?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onRevise: (feedback?: string) => void | Promise<void>;
  onDismiss?: () => void;
};

/**
 * Confirm-before-save preview for overdue quest reschedules (Issue #14).
 * Due dates are written only after the user confirms.
 */
export function ReschedulePreview({
  draft,
  goal = null,
  milestone = null,
  loading = false,
  busy = false,
  error = null,
  onConfirm,
  onRevise,
  onDismiss,
}: ReschedulePreviewProps) {
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  if (loading && !draft) {
    return (
      <section
        className="mt-4 w-full max-w-[640px] rounded-window border-[3px] border-pink/40 bg-blue-pale px-4 py-4 text-center shadow-window"
        data-testid="reschedule-preview"
        aria-busy="true"
        aria-label="Sketching a kinder schedule"
      >
        <p className="m-0 text-[0.9rem] text-ink-soft">
          Mochi is sketching softer due dates…
        </p>
      </section>
    );
  }

  if (!draft) {
    return null;
  }

  const budget = goal?.time_budget_minutes_per_day ?? null;

  return (
    <section
      className="mt-4 w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink bg-blue-pale shadow-window animate-rise-in"
      data-testid="reschedule-preview"
      aria-label="Preview your reschedule"
    >
      <header className="flex items-center justify-between gap-2 bg-gel-pink px-4 py-[0.65rem] font-display text-[1rem] text-white">
        <span>✦ Let&apos;s adjust the plan</span>
        {onDismiss ? (
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="rounded-full bg-white/25 px-2 py-0.5 text-[0.8rem] font-bold text-white hover:bg-white/35 disabled:opacity-55"
            aria-label="Close reschedule preview"
            data-testid="reschedule-dismiss"
          >
            ✕
          </button>
        ) : null}
      </header>

      <div className="px-4 py-3">
        {milestone ? (
          <p className="m-0 text-[0.85rem] text-ink-soft">
            For stage{' '}
            <span className="font-bold text-ink" data-testid="reschedule-milestone">
              {milestone.title}
            </span>
            {budget != null ? (
              <>
                {' '}
                ·{' '}
                <span data-testid="reschedule-budget">{budget} min/day</span>
              </>
            ) : null}
          </p>
        ) : null}

        <ul className="mt-3 m-0 list-none space-y-2 p-0" data-testid="reschedule-moves">
          {draft.moves.map((move) => (
            <li
              key={move.quest_id}
              className="rounded-[14px] border border-pink/20 bg-panel px-3 py-2"
              data-testid={`reschedule-move-${move.quest_id}`}
            >
              <p className="m-0 text-[0.9rem] font-bold text-ink">{move.title}</p>
              <p className="mt-0.5 m-0 font-ui text-[0.8rem] text-ink-soft">
                <span data-testid={`reschedule-from-${move.quest_id}`}>{move.from_date}</span>
                <span aria-hidden="true"> → </span>
                <span
                  className="font-bold text-blue-ink"
                  data-testid={`reschedule-to-${move.quest_id}`}
                >
                  {move.to_date}
                </span>
                {move.estimated_minutes != null ? (
                  <span> · ~{move.estimated_minutes} min</span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>

        <p
          className="mt-3 m-0 text-[0.88rem] text-ink"
          data-testid="reschedule-mochi-message"
        >
          {draft.mochi_message}
        </p>

        {error ? (
          <p className="mt-2 m-0 text-[0.85rem] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {showFeedback ? (
          <label className="mt-3 block">
            <span className="sr-only">Tell Mochi how to adjust the dates</span>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={busy}
              rows={2}
              placeholder="e.g. lighter tomorrow, push one day later…"
              className="w-full resize-none rounded-[14px] border-2 border-pink/25 bg-panel px-3 py-2 text-[0.9rem] text-ink outline-none focus:border-pink"
              data-testid="reschedule-revise-feedback"
            />
          </label>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void onConfirm();
            }}
            className="rounded-pill bg-gel-pink px-4 py-2 text-[0.88rem] font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] disabled:cursor-not-allowed disabled:opacity-55"
            data-testid="reschedule-confirm"
          >
            ★ Looks good — save new dates
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!showFeedback) {
                setShowFeedback(true);
                return;
              }
              void (async () => {
                await onRevise(feedback.trim() || undefined);
                setFeedback('');
                setShowFeedback(false);
              })();
            }}
            className="rounded-pill bg-blue-ink px-4 py-2 text-[0.88rem] font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
            data-testid="reschedule-revise"
          >
            {showFeedback ? 'Ask Mochi to edit' : 'Edit with Mochi'}
          </button>
        </div>
      </div>
    </section>
  );
}
