import { useState } from 'react';
import type { Goal, GoalDraft } from '@questline/shared';

export type GoalConfirmCardProps = {
  draft: GoalDraft | null;
  confirmedGoal?: Goal | null;
  loading?: boolean;
  busy?: boolean;
  error?: string | null;
  onAccept: () => void | Promise<void>;
  /** Ask Mochi to revise the draft (optional feedback). */
  onRevise: (feedback?: string) => void | Promise<void>;
  /** Return to the interview to tweak answers. */
  onReturnToInterview: () => void | Promise<void>;
};

export function GoalConfirmCard({
  draft,
  confirmedGoal = null,
  loading = false,
  busy = false,
  error = null,
  onAccept,
  onRevise,
  onReturnToInterview,
}: GoalConfirmCardProps) {
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  if (confirmedGoal) {
    return (
      <section
        className="border-t border-pink/20 bg-meadow/50 px-4 py-3"
        data-testid="goal-confirm-card"
        aria-label="Goal confirmed"
      >
        <p className="m-0 font-display text-[0.95rem] text-ink">Goal saved ♡</p>
        <p className="mt-1 m-0 text-[0.92rem] font-bold text-ink" data-testid="goal-confirmed-title">
          {confirmedGoal.title}
        </p>
        {confirmedGoal.deadline ? (
          <p className="mt-1 m-0 text-[0.82rem] text-ink-soft">Deadline: {confirmedGoal.deadline}</p>
        ) : null}
        <p className="mt-2 m-0 text-[0.82rem] text-ink-soft">
          Next, Mochi can help draw your map of milestones.
        </p>
      </section>
    );
  }

  if (loading && !draft) {
    return (
      <section
        className="border-t border-pink/20 bg-purple-pale px-4 py-3 text-center"
        data-testid="goal-confirm-card"
        aria-busy="true"
        aria-label="Drafting your goal"
      >
        <p className="m-0 text-[0.9rem] text-ink-soft">Mochi is drafting a concrete goal…</p>
      </section>
    );
  }

  if (!draft) {
    return null;
  }

  return (
    <section
      className="border-t border-pink/20 bg-purple-pale px-4 py-3"
      data-testid="goal-confirm-card"
      aria-label="Confirm your goal"
    >
      <p className="m-0 font-display text-[0.95rem] text-pink-ink">Proposed goal</p>
      <p className="mt-1 m-0 text-[1rem] font-bold leading-snug text-ink" data-testid="goal-draft-title">
        {draft.title}
      </p>
      <dl className="mt-2 m-0 grid gap-1 text-[0.82rem] text-ink-soft">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-bold text-ink">Deadline</dt>
          <dd className="m-0" data-testid="goal-draft-deadline">
            {draft.deadline}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-bold text-ink">Starting point</dt>
          <dd className="m-0" data-testid="goal-draft-starting-point">
            {draft.starting_point}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-bold text-ink">Time budget</dt>
          <dd className="m-0" data-testid="goal-draft-time-budget">
            {draft.time_budget_minutes_per_day} min / day
          </dd>
        </div>
      </dl>
      <p className="mt-2 m-0 text-[0.88rem] text-ink" data-testid="goal-draft-mochi-message">
        {draft.mochi_message}
      </p>

      {error ? (
        <p className="mt-2 m-0 text-[0.85rem] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {showFeedback ? (
        <label className="mt-3 block">
          <span className="sr-only">Feedback for Mochi</span>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={busy}
            rows={2}
            placeholder="Tell Mochi what to tweak…"
            className="w-full resize-none rounded-[14px] border-2 border-pink/25 bg-panel px-3 py-2 text-[0.9rem] text-ink outline-none focus:border-pink"
            data-testid="goal-revise-feedback"
          />
        </label>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void onAccept();
          }}
          className="rounded-pill bg-gel-pink px-4 py-2 text-[0.88rem] font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] disabled:cursor-not-allowed disabled:opacity-55"
          data-testid="goal-accept"
        >
          ★ Start this goal
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
          data-testid="goal-revise"
        >
          {showFeedback ? 'Ask Mochi to revise' : 'Revise with Mochi'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void onReturnToInterview();
          }}
          className="rounded-pill bg-white px-4 py-2 text-[0.88rem] font-bold text-blue-ink shadow-sm disabled:cursor-not-allowed disabled:opacity-55"
          data-testid="goal-return-interview"
        >
          Adjust answers
        </button>
      </div>
    </section>
  );
}
