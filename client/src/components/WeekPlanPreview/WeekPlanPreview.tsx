import { useMemo, useState } from 'react';
import type {
  Milestone,
  MilestoneGoalSummary,
  WeekPlanDraft,
} from '@questline/shared';

export type WeekPlanPreviewProps = {
  draft: WeekPlanDraft | null;
  goal?: MilestoneGoalSummary | null;
  milestone?: Milestone | null;
  loading?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onRevise: (feedback?: string) => void | Promise<void>;
  onDismiss?: () => void;
};

type DayGroup = {
  due_date: string;
  quests: WeekPlanDraft['quests'];
  totalMinutes: number;
};

/**
 * Confirm-before-save preview for a 7-day week plan (Issue #15).
 * Quests are written only after the user confirms.
 */
export function WeekPlanPreview({
  draft,
  goal = null,
  milestone = null,
  loading = false,
  busy = false,
  error = null,
  onConfirm,
  onRevise,
  onDismiss,
}: WeekPlanPreviewProps) {
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const days = useMemo<DayGroup[]>(() => {
    if (!draft) return [];
    const map = new Map<string, WeekPlanDraft['quests']>();
    for (const quest of draft.quests) {
      const list = map.get(quest.due_date) ?? [];
      list.push(quest);
      map.set(quest.due_date, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([due_date, quests]) => ({
        due_date,
        quests,
        totalMinutes: quests.reduce((sum, q) => sum + q.estimated_minutes, 0),
      }));
  }, [draft]);

  if (loading && !draft) {
    return (
      <section
        className="mt-4 w-full max-w-[640px] rounded-window border-[3px] border-pink/40 bg-blue-pale px-4 py-4 text-center shadow-window"
        data-testid="week-plan-preview"
        aria-busy="true"
        aria-label="Sketching a gentle week"
      >
        <p className="m-0 text-[0.9rem] text-ink-soft">
          Mochi is sketching a gentle week of tiny steps…
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
      data-testid="week-plan-preview"
      aria-label="Preview your week plan"
    >
      <header className="flex items-center justify-between gap-2 bg-gel-pink px-4 py-[0.65rem] font-display text-[1rem] text-white">
        <span>✦ A gentle week ahead</span>
        {onDismiss ? (
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="rounded-full bg-white/25 px-2 py-0.5 text-[0.8rem] font-bold text-white hover:bg-white/35 disabled:opacity-55"
            aria-label="Close week plan preview"
            data-testid="week-plan-dismiss"
          >
            ✕
          </button>
        ) : null}
      </header>

      <div className="px-4 py-3">
        {milestone ? (
          <p className="m-0 text-[0.85rem] text-ink-soft">
            For stage{' '}
            <span className="font-bold text-ink" data-testid="week-plan-milestone">
              {milestone.title}
            </span>
            {budget != null ? (
              <>
                {' '}
                ·{' '}
                <span data-testid="week-plan-budget">{budget} min/day</span>
              </>
            ) : null}
          </p>
        ) : null}

        <p className="mt-1 m-0 text-[0.8rem] text-ink-soft" data-testid="week-plan-window">
          {draft.week_start} → {draft.week_end}
        </p>

        <ul className="mt-3 m-0 list-none space-y-3 p-0" data-testid="week-plan-days">
          {days.map((day) => (
            <li
              key={day.due_date}
              className="rounded-[14px] border border-pink/20 bg-panel px-3 py-2"
              data-testid={`week-plan-day-${day.due_date}`}
            >
              <p className="m-0 flex items-baseline justify-between gap-2 font-ui text-[0.8rem] font-bold text-blue-ink">
                <span>{day.due_date}</span>
                <span className="font-normal text-ink-soft">~{day.totalMinutes} min</span>
              </p>
              <ul className="mt-1.5 m-0 list-none space-y-1 p-0">
                {day.quests.map((quest) => (
                  <li
                    key={`${quest.due_date}-${quest.title}`}
                    className="text-[0.9rem] text-ink"
                    data-testid={`week-plan-quest-${quest.due_date}-${quest.title}`}
                  >
                    <span className="font-bold">{quest.title}</span>
                    <span className="text-ink-soft"> · ~{quest.estimated_minutes} min</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <p
          className="mt-3 m-0 text-[0.88rem] text-ink"
          data-testid="week-plan-mochi-message"
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
            <span className="sr-only">Tell Mochi how to adjust the week</span>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={busy}
              rows={2}
              placeholder="e.g. lighter midweek, skip Friday…"
              className="w-full resize-none rounded-[14px] border-2 border-pink/25 bg-panel px-3 py-2 text-[0.9rem] text-ink outline-none focus:border-pink"
              data-testid="week-plan-revise-feedback"
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
            data-testid="week-plan-confirm"
          >
            ★ Looks good — save this week
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
            data-testid="week-plan-revise"
          >
            {showFeedback ? 'Ask Mochi to edit' : 'Edit with Mochi'}
          </button>
        </div>
      </div>
    </section>
  );
}
