import { useState } from 'react';
import type { Milestone, MilestoneGoalSummary, MilestonePlanDraft } from '@questline/shared';

export type MilestonePlanEditorProps = {
  draft: MilestonePlanDraft | null;
  goal?: MilestoneGoalSummary | null;
  confirmedMilestones?: Milestone[];
  loading?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  /** Ask Mochi to add / remove / rename / reorder via chat-style feedback. */
  onRevise: (feedback?: string) => void | Promise<void>;
};

export function MilestonePlanEditor({
  draft,
  goal = null,
  confirmedMilestones = [],
  loading = false,
  busy = false,
  error = null,
  onConfirm,
  onRevise,
}: MilestonePlanEditorProps) {
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  if (confirmedMilestones.length > 0 && !draft) {
    return (
      <section
        className="mt-4 w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink bg-meadow/60 shadow-window animate-rise-in"
        data-testid="milestone-plan-editor"
        aria-label="Milestone plan saved"
      >
        <header className="bg-gel-pink px-4 py-[0.65rem] font-display text-[1rem] text-white">
          🗺️ Your map is saved
        </header>
        <div className="px-4 py-3">
          {goal ? (
            <p className="m-0 text-[0.9rem] font-bold text-ink" data-testid="milestone-goal-title">
              {goal.title}
            </p>
          ) : null}
          <ol className="mt-2 m-0 list-none space-y-2 p-0" data-testid="milestone-saved-list">
            {confirmedMilestones.map((item) => (
              <li
                key={item.id}
                className="rounded-[14px] bg-panel/80 px-3 py-2 text-[0.88rem] text-ink"
                data-testid={`milestone-saved-${item.position}`}
              >
                <span className="font-bold text-pink-ink">Stage {item.position}</span>
                <span className="mx-1.5 text-ink-soft">·</span>
                <span className="font-bold">{item.title}</span>
                {item.target_date ? (
                  <span className="mt-0.5 block text-[0.78rem] text-ink-soft">
                    Target: {item.target_date}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-2 m-0 text-[0.82rem] text-ink-soft">
            Next, Mochi can sketch daily quests for your current stage.
          </p>
        </div>
      </section>
    );
  }

  if (loading && !draft) {
    return (
      <section
        className="mt-4 w-full max-w-[640px] rounded-window border-[3px] border-pink/40 bg-purple-pale px-4 py-4 text-center shadow-window"
        data-testid="milestone-plan-editor"
        aria-busy="true"
        aria-label="Drafting your milestone map"
      >
        <p className="m-0 text-[0.9rem] text-ink-soft">Mochi is sketching your milestone map…</p>
      </section>
    );
  }

  if (!draft) {
    return null;
  }

  return (
    <section
      className="mt-4 w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink bg-purple-pale shadow-window animate-rise-in"
      data-testid="milestone-plan-editor"
      aria-label="Edit your milestone plan"
    >
      <header className="bg-gel-pink px-4 py-[0.65rem] font-display text-[1rem] text-white">
        🗺️ Milestone map
      </header>
      <div className="px-4 py-3">
        {goal ? (
          <p className="m-0 text-[0.85rem] text-ink-soft">
            For{' '}
            <span className="font-bold text-ink" data-testid="milestone-goal-title">
              {goal.title}
            </span>
            {goal.deadline ? (
              <>
                {' '}
                · deadline <span data-testid="milestone-goal-deadline">{goal.deadline}</span>
              </>
            ) : null}
          </p>
        ) : null}

        <ol className="mt-3 m-0 list-none space-y-2 p-0" data-testid="milestone-draft-list">
          {draft.milestones.map((item) => (
            <li
              key={`${item.position}-${item.title}`}
              className="rounded-[14px] border border-pink/20 bg-panel px-3 py-2"
              data-testid={`milestone-draft-${item.position}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-display text-[0.9rem] text-pink-ink">
                  Stage {item.position}
                </span>
                <span
                  className="text-[0.95rem] font-bold text-ink"
                  data-testid={`milestone-draft-title-${item.position}`}
                >
                  {item.title}
                </span>
              </div>
              <p
                className="mt-1 m-0 text-[0.84rem] text-ink-soft"
                data-testid={`milestone-draft-description-${item.position}`}
              >
                {item.description}
              </p>
              <p
                className="mt-1 m-0 text-[0.78rem] font-bold text-blue-ink"
                data-testid={`milestone-draft-date-${item.position}`}
              >
                Target: {item.target_date}
              </p>
            </li>
          ))}
        </ol>

        <p
          className="mt-3 m-0 text-[0.88rem] text-ink"
          data-testid="milestone-draft-mochi-message"
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
            <span className="sr-only">Tell Mochi how to edit the map</span>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={busy}
              rows={2}
              placeholder="e.g. add a polish stage, rename stage 2, swap 1 and 2…"
              className="w-full resize-none rounded-[14px] border-2 border-pink/25 bg-panel px-3 py-2 text-[0.9rem] text-ink outline-none focus:border-pink"
              data-testid="milestone-revise-feedback"
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
            data-testid="milestone-confirm"
          >
            ★ Looks good — save my map
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
            data-testid="milestone-revise"
          >
            {showFeedback ? 'Ask Mochi to edit' : 'Edit with Mochi'}
          </button>
        </div>
      </div>
    </section>
  );
}
