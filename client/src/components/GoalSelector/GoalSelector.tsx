import { useId, useState } from 'react';
import type { Goal } from '@questline/shared';

export type GoalSelectorProps = {
  goals: Goal[];
  activeGoalId: number | null;
  loading?: boolean;
  busy?: boolean;
  error?: string | null;
  onSelect: (goalId: number) => void | Promise<void>;
  onNewGoal: () => void | Promise<void>;
  onDelete: (goalId: number) => void | Promise<void>;
};

/**
 * Today HUD — "Current goal" selector (Issue #18).
 * One active goal at a time; others stay paused/completed until switched or deleted.
 */
export function GoalSelector({
  goals,
  activeGoalId,
  loading = false,
  busy = false,
  error = null,
  onSelect,
  onNewGoal,
  onDelete,
}: GoalSelectorProps) {
  const selectId = useId();
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const disabled = loading || busy;
  const active = goals.find((g) => g.id === activeGoalId) ?? null;
  const pendingDelete = goals.find((g) => g.id === pendingDeleteId) ?? null;

  return (
    <div
      className="w-full max-w-[640px] rounded-[14px] border border-pink/35 bg-white/75 px-3 py-2.5 shadow-sm"
      data-testid="goal-selector"
      role="group"
      aria-label="Current goal"
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label
            htmlFor={selectId}
            className="mb-1 block font-ui text-[0.72rem] font-bold uppercase tracking-[0.04em] text-ink-soft"
          >
            Current goal
          </label>
          {loading && goals.length === 0 ? (
            <p className="m-0 text-[0.9rem] text-ink-soft" data-testid="goal-selector-loading">
              Finding your goals…
            </p>
          ) : goals.length === 0 ? (
            <p className="m-0 text-[0.9rem] text-ink-soft" data-testid="goal-selector-empty">
              No goals yet — start one with Mochi ♡
            </p>
          ) : (
            <select
              id={selectId}
              data-testid="goal-selector-select"
              value={activeGoalId ?? ''}
              disabled={disabled}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || next <= 0) return;
                void onSelect(next);
              }}
              className="w-full max-w-full truncate rounded-pill border-2 border-pink/25 bg-panel px-3 py-2 text-[0.92rem] font-bold text-ink outline-none focus:border-pink disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Switch current goal"
            >
              {!activeGoalId ? (
                <option value="" disabled>
                  Pick a goal…
                </option>
              ) : null}
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.status === 'active' ? '✦ ' : goal.status === 'completed' ? '✓ ' : ''}
                  {goal.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          data-testid="goal-selector-new"
          disabled={disabled}
          onClick={() => {
            void onNewGoal();
          }}
          className="shrink-0 rounded-pill bg-gel-pink px-3.5 py-2 text-[0.82rem] font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
        >
          ＋ New goal
        </button>

        {active ? (
          <button
            type="button"
            data-testid="goal-selector-delete"
            disabled={disabled}
            onClick={() => {
              setPendingDeleteId(active.id);
            }}
            className="shrink-0 rounded-pill border-2 border-danger/40 bg-white px-3 py-2 text-[0.82rem] font-bold text-danger hover:bg-pink-pale disabled:cursor-not-allowed disabled:opacity-55"
          >
            Delete
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mb-0 mt-2 text-[0.85rem] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {pendingDelete ? (
        <div
          className="mt-3 rounded-[12px] border border-danger/30 bg-pink-pale px-3 py-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${selectId}-delete-title`}
          data-testid="goal-selector-delete-confirm"
        >
          <p
            id={`${selectId}-delete-title`}
            className="m-0 text-[0.92rem] font-bold text-ink"
          >
            Delete “{pendingDelete.title}”?
          </p>
          <p className="mb-0 mt-1 text-[0.85rem] text-ink-soft">
            This also removes its stages and quests. You can&apos;t undo this.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="goal-selector-delete-confirm-yes"
              disabled={disabled}
              onClick={() => {
                void (async () => {
                  try {
                    await onDelete(pendingDelete.id);
                    setPendingDeleteId(null);
                  } catch {
                    // Error surfaced via props.error from the hook.
                  }
                })();
              }}
              className="rounded-pill bg-danger px-3.5 py-2 text-[0.82rem] font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              Yes, delete
            </button>
            <button
              type="button"
              data-testid="goal-selector-delete-confirm-no"
              disabled={disabled}
              onClick={() => {
                setPendingDeleteId(null);
              }}
              className="rounded-pill bg-white px-3.5 py-2 text-[0.82rem] font-bold text-blue-ink shadow-sm hover:bg-blue-pale disabled:cursor-not-allowed disabled:opacity-55"
            >
              Keep it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
