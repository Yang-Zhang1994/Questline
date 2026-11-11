import { useState, type FormEvent } from 'react';
import type { Milestone, ProposedMilestone, RoadmapGoal } from '@questline/shared';

export type MilestonePlanEditorProps = {
  goal: RoadmapGoal | null;
  draftMilestones: ProposedMilestone[] | null;
  savedMilestones: Milestone[];
  proposing?: boolean;
  confirming?: boolean;
  confirmed?: boolean;
  error?: string | null;
  onPropose: () => void | Promise<void>;
  onAdjust: (feedback: string) => void | Promise<void>;
  onConfirm: () => void | Promise<void>;
};

export function MilestonePlanEditor({
  goal,
  draftMilestones,
  savedMilestones,
  proposing = false,
  confirming = false,
  confirmed = false,
  error = null,
  onPropose,
  onAdjust,
  onConfirm,
}: MilestonePlanEditorProps) {
  const [feedbackDraft, setFeedbackDraft] = useState('');

  if (!goal) {
    return null;
  }

  const busy = proposing || confirming;
  const hasDraft = draftMilestones !== null && draftMilestones.length > 0;
  const hasSaved = savedMilestones.length > 0;

  async function handleAdjustSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = feedbackDraft.trim();
    if (!trimmed || busy) return;
    setFeedbackDraft('');
    await onAdjust(trimmed);
  }

  return (
    <section
      className="mt-4 flex w-full max-w-[640px] flex-col overflow-hidden rounded-window border-[3px] border-pink bg-pink-pale shadow-window animate-rise-in"
      aria-label="Milestone plan"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 bg-gel-pink px-4 py-[0.65rem] font-display text-[1rem] text-white">
        <span className="inline-flex items-center gap-1.5">🗺️ Milestone Plan</span>
        {hasDraft ? (
          <span
            data-testid="milestone-draft-badge"
            className="rounded-pill bg-white/25 px-2.5 py-0.5 font-body text-[0.75rem] font-bold text-white"
          >
            Draft preview — not saved yet
          </span>
        ) : hasSaved ? (
          <span className="rounded-pill bg-meadow px-2.5 py-0.5 font-body text-[0.75rem] font-bold text-ink">
            {savedMilestones.length} stages on map
          </span>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 bg-panel/85 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-window border border-pink/25 bg-blue-pale/70 px-3.5 py-2.5">
          <div>
            <p className="m-0 text-[0.75rem] font-bold uppercase tracking-wide text-blue-ink">
              Active Goal
            </p>
            <p className="m-0 font-display text-[0.98rem] text-ink">{goal.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[0.78rem] font-bold text-ink-soft">
            {goal.time_budget_minutes_per_day ? (
              <span className="rounded-pill bg-panel px-2.5 py-1">
                ⏱ {goal.time_budget_minutes_per_day} min/day
              </span>
            ) : null}
            {goal.deadline ? (
              <span className="rounded-pill bg-panel px-2.5 py-1">
                🎯 Deadline: {goal.deadline}
              </span>
            ) : null}
          </div>
        </div>

        {error ? (
          <p
            className="m-0 rounded-window border border-danger/30 bg-pink-pale px-3 py-2 text-[0.88rem] text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {confirmed ? (
          <p
            data-testid="milestone-confirmed-banner"
            className="m-0 rounded-window border border-tree bg-meadow/70 px-3.5 py-2 text-[0.88rem] font-bold text-ink"
          >
            ✦ Milestone plan saved! Stage 1 is now current on your Map ♡
          </p>
        ) : null}

        {!hasDraft ? (
          <div className="flex flex-col gap-3">
            {hasSaved ? (
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {savedMilestones.map((item) => (
                  <li
                    key={item.id}
                    data-testid={`saved-milestone-${item.position}`}
                    className="flex items-start justify-between gap-3 rounded-window border border-pink/25 bg-panel px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-pill bg-pink-pale px-2 py-0.5 text-[0.72rem] font-bold text-pink-ink">
                          Stage {item.position}
                        </span>
                        <span className="font-bold text-ink">{item.title}</span>
                      </div>
                      {item.description ? (
                        <p className="m-0 mt-1 text-[0.85rem] text-ink-soft">{item.description}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-[0.75rem]">
                      <span
                        className={[
                          'inline-block rounded-pill px-2.5 py-0.5 font-bold',
                          item.status === 'current'
                            ? 'bg-gel-pink text-white'
                            : item.status === 'completed'
                              ? 'bg-meadow text-ink'
                              : 'bg-blue-pale text-blue-ink',
                        ].join(' ')}
                      >
                        {item.status === 'current'
                          ? 'Current'
                          : item.status === 'completed'
                            ? 'Completed'
                            : 'Upcoming'}
                      </span>
                      {item.target_date ? (
                        <p className="m-0 mt-1 text-ink-soft">{item.target_date}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="m-0 text-[0.9rem] text-ink-soft">
                Ready to break your goal into 3–7 cozy stages? Ask Mochi to propose a milestone
                roadmap, then tweak it together before saving.
              </p>
            )}

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  void onPropose();
                }}
                disabled={busy}
                className="rounded-pill bg-gel-pink px-4 py-2 font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {proposing
                  ? 'Mochi is sketching stages…'
                  : hasSaved
                    ? '🗺️ Update my map'
                    : '🗺️ Draw my map'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {draftMilestones.map((item, idx) => {
                const stageNumber = idx + 1;
                return (
                  <li
                    key={`${stageNumber}-${item.title}`}
                    data-testid={`proposed-milestone-${stageNumber}`}
                    className="rounded-window border-2 border-pink/30 bg-panel px-3.5 py-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-pill bg-gel-pink px-2.5 py-0.5 text-[0.74rem] font-bold text-white">
                          Stage {stageNumber}
                        </span>
                        <span className="font-bold text-ink">{item.title}</span>
                      </div>
                      <span className="rounded-pill bg-blue-pale px-2.5 py-0.5 text-[0.76rem] font-bold text-blue-ink">
                        By {item.target_date}
                      </span>
                    </div>
                    <p className="m-0 mt-1.5 text-[0.88rem] text-ink-soft">{item.description}</p>
                  </li>
                );
              })}
            </ol>

            <form
              onSubmit={(e) => {
                void handleAdjustSubmit(e);
              }}
              className="flex flex-wrap items-center gap-2 rounded-window border border-pink/25 bg-pink-pale/60 p-2.5"
            >
              <label className="sr-only" htmlFor="mochi-milestone-adjust-input">
                Ask Mochi to adjust milestones
              </label>
              <input
                id="mochi-milestone-adjust-input"
                type="text"
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
                placeholder="Ask Mochi to add, remove, rename, or reorder stages…"
                disabled={busy}
                className="min-w-[200px] flex-1 rounded-pill border-2 border-pink/25 bg-panel px-3.5 py-2 text-[0.9rem] text-ink outline-none placeholder:text-ink-soft/70 focus:border-pink"
              />
              <button
                type="submit"
                disabled={busy || feedbackDraft.trim().length === 0}
                className="rounded-pill bg-panel px-3.5 py-2 text-[0.85rem] font-bold text-blue-ink shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
              >
                {proposing ? 'Adjusting…' : 'Adjust with Mochi'}
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="m-0 text-[0.78rem] text-ink-soft">
                Stage 1 will start as <strong>Current</strong>; the rest stay{' '}
                <strong>Upcoming</strong> until you clear each stage.
              </p>
              <button
                type="button"
                onClick={() => {
                  void onConfirm();
                }}
                disabled={busy}
                className="rounded-pill bg-gel-pink px-4 py-2 font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {confirming ? 'Saving plan…' : '★ Confirm milestones'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
