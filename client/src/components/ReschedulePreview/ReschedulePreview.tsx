import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Milestone, Quest, RescheduleMove, RoadmapGoal } from '@questline/shared';

export type ReschedulePreviewProps = {
  goal: RoadmapGoal | null;
  milestone: Milestone | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  timeBudgetMinutesPerDay?: number;
  overdueQuests?: Quest[];
  existingQuests?: Quest[];
  draftMoves: RescheduleMove[] | null;
  mochiMessage?: string | null;
  proposing?: boolean;
  confirming?: boolean;
  confirmed?: boolean;
  error?: string | null;
  onPropose: () => void | Promise<void>;
  onAdjust: (feedback: string) => void | Promise<void>;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

type RescheduleDayGroup = {
  date: string;
  existing: Quest[];
  moves: RescheduleMove[];
  existingMinutes: number;
  movedMinutes: number;
  totalMinutes: number;
};

function groupMovesByDay(
  existingQuests: Quest[],
  draftMoves: RescheduleMove[],
): RescheduleDayGroup[] {
  const movingIds = new Set(draftMoves.map((m) => m.quest_id));
  const datesSet = new Set<string>();
  for (const m of draftMoves) {
    datesSet.add(m.to_date);
  }

  const sortedDates = [...datesSet].sort();
  return sortedDates.map((date) => {
    const existing = existingQuests.filter(
      (q) => !movingIds.has(q.id) && q.due_date === date,
    );
    const moves = draftMoves.filter((m) => m.to_date === date);
    const existingMinutes = existing.reduce(
      (sum, q) => sum + (q.estimated_minutes && q.estimated_minutes > 0 ? q.estimated_minutes : 0),
      0,
    );
    const movedMinutes = moves.reduce((sum, m) => sum + m.estimated_minutes, 0);
    return {
      date,
      existing,
      moves,
      existingMinutes,
      movedMinutes,
      totalMinutes: existingMinutes + movedMinutes,
    };
  });
}

export function ReschedulePreview({
  goal,
  milestone,
  windowStart = null,
  windowEnd = null,
  timeBudgetMinutesPerDay,
  existingQuests = [],
  draftMoves,
  mochiMessage = null,
  proposing = false,
  confirming = false,
  confirmed = false,
  error = null,
  onAdjust,
  onConfirm,
  onCancel,
}: ReschedulePreviewProps) {
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const sectionRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const wasOpenRef = useRef(false);

  const busy = proposing || confirming;
  const hasDraft = draftMoves !== null && draftMoves.length > 0;
  const isOpen = Boolean(goal && milestone && (hasDraft || confirmed || error));

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      headingRef.current?.focus({ preventScroll: true });
      sectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  if (!goal || !milestone || !isOpen) {
    return null;
  }

  const budget =
    timeBudgetMinutesPerDay && timeBudgetMinutesPerDay > 0
      ? timeBudgetMinutesPerDay
      : goal.time_budget_minutes_per_day && goal.time_budget_minutes_per_day > 0
        ? goal.time_budget_minutes_per_day
        : 30;

  const dayGroups = hasDraft ? groupMovesByDay(existingQuests, draftMoves) : [];

  async function handleAdjustSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = feedbackDraft.trim();
    if (!trimmed || busy) return;
    setFeedbackDraft('');
    await onAdjust(trimmed);
  }

  return (
    <section
      ref={sectionRef}
      data-testid="reschedule-preview"
      className="mt-2 scroll-mt-6 flex w-full max-w-[640px] flex-col overflow-hidden rounded-window border-[3px] border-pink bg-pink-pale shadow-window animate-rise-in"
      aria-label="Mochi schedule preview"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 bg-gel-pink px-4 py-[0.65rem] font-display text-[1rem] text-white">
        <h2
          ref={headingRef}
          id="reschedule-preview-heading"
          data-testid="reschedule-preview-heading"
          tabIndex={-1}
          className="m-0 inline-flex items-center gap-1.5 rounded font-display text-[1rem] font-normal text-white outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          ✨ Mochi&apos;s New Schedule Preview
        </h2>
        {hasDraft ? (
          <span
            data-testid="reschedule-draft-badge"
            className="rounded-pill bg-white/25 px-2.5 py-0.5 font-body text-[0.75rem] font-bold text-white"
          >
            Preview — not saved yet
          </span>
        ) : windowStart && windowEnd ? (
          <span className="rounded-pill bg-white/25 px-2.5 py-0.5 font-body text-[0.75rem] font-bold text-white">
            {windowStart} → {windowEnd}
          </span>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 bg-panel/85 px-4 py-4">
        {mochiMessage ? (
          <p
            data-testid="reschedule-mochi-message"
            className="m-0 rounded-window border border-pink/25 bg-pink-pale/70 px-3.5 py-2.5 text-[0.92rem] font-bold text-ink"
          >
            {mochiMessage}
          </p>
        ) : null}

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
            data-testid="reschedule-confirmed-banner"
            className="m-0 rounded-window border border-tree bg-meadow/70 px-3.5 py-2 text-[0.88rem] font-bold text-ink"
          >
            ✦ New dates saved! Your quest diary is updated ♡
          </p>
        ) : null}

        {hasDraft ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2.5" data-testid="reschedule-day-groups">
              {dayGroups.map((group) => (
                <div
                  key={group.date}
                  data-testid={`reschedule-day-${group.date}`}
                  className="rounded-window border-2 border-pink/30 bg-panel px-3.5 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pink/15 pb-2">
                    <span className="rounded-pill bg-gel-pink px-2.5 py-0.5 text-[0.76rem] font-bold text-white">
                      {group.date}
                    </span>
                    <span
                      data-testid={`reschedule-day-total-${group.date}`}
                      className="rounded-pill bg-blue-pale px-2.5 py-0.5 text-[0.76rem] font-bold text-blue-ink"
                    >
                      Total: {group.totalMinutes} / {budget} min
                    </span>
                  </div>

                  <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                    {group.existing.map((q) => (
                      <li
                        key={`existing-${q.id}`}
                        data-testid={`reschedule-existing-quest-${q.id}`}
                        className="flex items-center justify-between gap-2 rounded-[10px] border border-pink/15 bg-pink-pale/40 px-3 py-1.5 text-[0.84rem] text-ink-soft"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="mr-1.5 font-bold text-blue-ink">
                            {q.completed_at ? '✓ Done:' : '• Already on this day:'}
                          </span>
                          {q.title}
                        </span>
                        <span className="shrink-0 rounded-pill bg-panel px-2 py-0.5 text-[0.74rem] font-bold text-ink-soft">
                          ~{q.estimated_minutes ?? 0} min
                        </span>
                      </li>
                    ))}

                    {group.moves.map((move) => (
                      <li
                        key={`move-${move.quest_id}`}
                        data-testid={`reschedule-move-${move.quest_id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-pink/30 bg-panel px-3 py-2 text-[0.88rem] font-bold text-ink"
                      >
                        <div className="min-w-0 flex-1">
                          <div>
                            <span className="mr-1.5 text-pink-ink" aria-hidden="true">
                              ✦
                            </span>
                            {move.title}
                          </div>
                          <div
                            data-testid={`reschedule-move-dates-${move.quest_id}`}
                            className="mt-0.5 text-[0.76rem] font-bold text-ink-soft"
                          >
                            <span>{move.from_date}</span>{' '}
                            <span aria-hidden="true">→</span>{' '}
                            <span className="text-pink-ink">{move.to_date}</span>
                          </div>
                        </div>
                        <span
                          data-testid="reschedule-move-minutes"
                          className="shrink-0 rounded-pill bg-blue-pale px-2.5 py-0.5 text-[0.76rem] font-bold text-blue-ink"
                        >
                          ~{move.estimated_minutes} min
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                void handleAdjustSubmit(e);
              }}
              className="flex flex-wrap items-center gap-2 rounded-window border border-pink/25 bg-pink-pale/60 p-2.5"
            >
              <label className="sr-only" htmlFor="mochi-reschedule-adjust-input">
                Ask Mochi to adjust schedule
              </label>
              <input
                id="mochi-reschedule-adjust-input"
                type="text"
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
                placeholder="Ask Mochi for changes (e.g. move to tomorrow, spread out more)…"
                disabled={busy}
                className="min-w-[200px] flex-1 rounded-pill border-2 border-pink/25 bg-panel px-3.5 py-2 text-[0.9rem] text-ink outline-none placeholder:text-ink-soft/70 focus:border-pink"
              />
              <button
                type="submit"
                disabled={busy || feedbackDraft.trim().length === 0}
                className="rounded-pill bg-panel px-3.5 py-2 text-[0.85rem] font-bold text-blue-ink shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
              >
                {proposing ? 'Adjusting…' : 'Ask Mochi for changes'}
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="m-0 text-[0.78rem] text-ink-soft">
                Nothing is saved until you confirm ♡
              </p>
              <div className="flex items-center gap-2">
                {onCancel ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    className="rounded-pill bg-panel px-3.5 py-2 text-[0.85rem] font-bold text-ink-soft shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Not right now
                  </button>
                ) : null}
                <button
                  type="button"
                  data-testid="accept-reschedule-button"
                  onClick={() => {
                    void onConfirm();
                  }}
                  disabled={busy}
                  className="rounded-pill bg-gel-pink px-4 py-2 font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {confirming ? 'Saving new dates…' : '★ Save new schedule'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
