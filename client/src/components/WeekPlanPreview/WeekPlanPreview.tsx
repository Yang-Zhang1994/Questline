import { useState, type FormEvent } from 'react';
import type { Milestone, ProposedQuest, Quest, RoadmapGoal } from '@questline/shared';

export type WeekPlanPreviewProps = {
  goal: RoadmapGoal | null;
  milestone: Milestone | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  timeBudgetMinutesPerDay?: number;
  existingQuests?: Quest[];
  draftQuests: ProposedQuest[] | null;
  proposing?: boolean;
  confirming?: boolean;
  confirmed?: boolean;
  error?: string | null;
  onPropose: () => void | Promise<void>;
  onAdjust: (feedback: string) => void | Promise<void>;
  onConfirm: () => void | Promise<void>;
};

type DayGroup = {
  date: string;
  existing: Quest[];
  proposed: ProposedQuest[];
  existingMinutes: number;
  proposedMinutes: number;
  totalMinutes: number;
};

function groupQuestsByDay(
  existingQuests: Quest[],
  draftQuests: ProposedQuest[],
  windowStart?: string | null,
  windowEnd?: string | null,
): DayGroup[] {
  const datesSet = new Set<string>();
  for (const q of draftQuests) {
    datesSet.add(q.due_date);
  }
  for (const q of existingQuests) {
    if (
      (!windowStart || q.due_date >= windowStart) &&
      (!windowEnd || q.due_date <= windowEnd)
    ) {
      datesSet.add(q.due_date);
    }
  }

  const sortedDates = [...datesSet].sort();
  return sortedDates.map((date) => {
    const existing = existingQuests.filter((q) => q.due_date === date);
    const proposed = draftQuests.filter((q) => q.due_date === date);
    const existingMinutes = existing.reduce(
      (sum, q) => sum + (q.estimated_minutes && q.estimated_minutes > 0 ? q.estimated_minutes : 0),
      0,
    );
    const proposedMinutes = proposed.reduce((sum, q) => sum + q.estimated_minutes, 0);
    return {
      date,
      existing,
      proposed,
      existingMinutes,
      proposedMinutes,
      totalMinutes: existingMinutes + proposedMinutes,
    };
  });
}

export function WeekPlanPreview({
  goal,
  milestone,
  windowStart = null,
  windowEnd = null,
  timeBudgetMinutesPerDay,
  existingQuests = [],
  draftQuests,
  proposing = false,
  confirming = false,
  confirmed = false,
  error = null,
  onPropose,
  onAdjust,
  onConfirm,
}: WeekPlanPreviewProps) {
  const [feedbackDraft, setFeedbackDraft] = useState('');

  if (!goal || !milestone) {
    return null;
  }

  const busy = proposing || confirming;
  const hasDraft = draftQuests !== null && draftQuests.length > 0;
  const budget =
    timeBudgetMinutesPerDay && timeBudgetMinutesPerDay > 0
      ? timeBudgetMinutesPerDay
      : goal.time_budget_minutes_per_day && goal.time_budget_minutes_per_day > 0
        ? goal.time_budget_minutes_per_day
        : 30;

  const dayGroups = hasDraft
    ? groupQuestsByDay(existingQuests, draftQuests, windowStart, windowEnd)
    : [];

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
      aria-label="Weekly quest plan"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 bg-gel-pink px-4 py-[0.65rem] font-display text-[1rem] text-white">
        <span className="inline-flex items-center gap-1.5">📅 Weekly Quest Plan</span>
        {hasDraft ? (
          <span
            data-testid="week-plan-draft-badge"
            className="rounded-pill bg-white/25 px-2.5 py-0.5 font-body text-[0.75rem] font-bold text-white"
          >
            Draft preview — not saved yet
          </span>
        ) : windowStart && windowEnd ? (
          <span className="rounded-pill bg-white/25 px-2.5 py-0.5 font-body text-[0.75rem] font-bold text-white">
            {windowStart} → {windowEnd}
          </span>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 bg-panel/85 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-window border border-pink/25 bg-blue-pale/70 px-3.5 py-2.5">
          <div>
            <p className="m-0 text-[0.75rem] font-bold uppercase tracking-wide text-blue-ink">
              Current Stage
            </p>
            <p className="m-0 font-display text-[0.98rem] text-ink">{milestone.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[0.78rem] font-bold text-ink-soft">
            <span className="rounded-pill bg-panel px-2.5 py-1">⏱ {budget} min/day budget</span>
            {milestone.target_date ? (
              <span className="rounded-pill bg-panel px-2.5 py-1">
                🎯 Stage target: {milestone.target_date}
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
            data-testid="week-plan-confirmed-banner"
            className="m-0 rounded-window border border-tree bg-meadow/70 px-3.5 py-2 text-[0.88rem] font-bold text-ink"
          >
            ✦ Weekly quest plan saved! Your new quests are ready on Today &amp; Map ♡
          </p>
        ) : null}

        {!hasDraft ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[0.9rem] text-ink-soft">
              Want Mochi to sketch the next 7 days of quests for{' '}
              <strong className="text-ink">{milestone.title}</strong>? Mochi will look at what is
              already done and scheduled, then fill in gentle daily steps within your {budget}{' '}
              min/day budget ♡
            </p>

            <div className="flex items-center justify-end">
              <button
                type="button"
                data-testid="plan-my-week-button"
                onClick={() => {
                  void onPropose();
                }}
                disabled={busy}
                className="rounded-pill bg-gel-pink px-4 py-2 font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {proposing ? 'Mochi is planning your week…' : '📅 Plan my week'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {windowStart && windowEnd ? (
              <p className="m-0 text-[0.82rem] font-bold text-ink-soft">
                Window: <span className="text-ink">{windowStart}</span> to{' '}
                <span className="text-ink">{windowEnd}</span>
              </p>
            ) : null}

            <div className="flex flex-col gap-2.5" data-testid="week-plan-day-groups">
              {dayGroups.map((group) => (
                <div
                  key={group.date}
                  data-testid={`week-plan-day-${group.date}`}
                  className="rounded-window border-2 border-pink/30 bg-panel px-3.5 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pink/15 pb-2">
                    <span className="rounded-pill bg-gel-pink px-2.5 py-0.5 text-[0.76rem] font-bold text-white">
                      {group.date}
                    </span>
                    <span
                      data-testid={`week-plan-day-total-${group.date}`}
                      className="rounded-pill bg-blue-pale px-2.5 py-0.5 text-[0.76rem] font-bold text-blue-ink"
                    >
                      Total: {group.totalMinutes} / {budget} min
                    </span>
                  </div>

                  <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                    {group.existing.map((q) => (
                      <li
                        key={`existing-${q.id}`}
                        data-testid={`week-plan-existing-quest-${q.id}`}
                        className="flex items-center justify-between gap-2 rounded-[10px] border border-pink/15 bg-pink-pale/40 px-3 py-1.5 text-[0.84rem] text-ink-soft"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="mr-1.5 font-bold text-blue-ink">
                            {q.completed_at ? '✓ Done:' : '• Scheduled:'}
                          </span>
                          {q.title}
                        </span>
                        <span className="shrink-0 rounded-pill bg-panel px-2 py-0.5 text-[0.74rem] font-bold text-ink-soft">
                          ~{q.estimated_minutes ?? 0} min
                        </span>
                      </li>
                    ))}

                    {group.proposed.map((q, idx) => (
                      <li
                        key={`proposed-${group.date}-${idx}-${q.title}`}
                        data-testid="week-plan-proposed-quest"
                        className="flex items-center justify-between gap-2 rounded-[10px] border border-pink/30 bg-panel px-3 py-1.5 text-[0.88rem] font-bold text-ink"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="mr-1.5 text-pink-ink" aria-hidden="true">
                            ✦
                          </span>
                          {q.title}
                        </span>
                        <span
                          data-testid="week-plan-proposed-minutes"
                          className="shrink-0 rounded-pill bg-blue-pale px-2.5 py-0.5 text-[0.76rem] font-bold text-blue-ink"
                        >
                          ~{q.estimated_minutes} min
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
              <label className="sr-only" htmlFor="mochi-week-plan-adjust-input">
                Ask Mochi to adjust weekly plan
              </label>
              <input
                id="mochi-week-plan-adjust-input"
                type="text"
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
                placeholder="Ask Mochi for changes (e.g. lighter tasks, more vocabulary)…"
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
                Existing quests stay untouched — accepting only adds the new quests above ♡
              </p>
              <button
                type="button"
                data-testid="accept-week-plan-button"
                onClick={() => {
                  void onConfirm();
                }}
                disabled={busy}
                className="rounded-pill bg-gel-pink px-4 py-2 font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {confirming ? 'Saving week plan…' : '★ Accept week plan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
