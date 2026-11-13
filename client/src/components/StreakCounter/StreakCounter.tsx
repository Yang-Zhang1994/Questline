import type { UserProgress } from '@questline/shared';

export type StreakCounterProps = {
  progress: Pick<UserProgress, 'current_streak' | 'best_streak'>;
};

/**
 * HUD "Days in a row" — current + best streak (Issue #12).
 * Cozy gel chip matching design tokens; no invented palette.
 */
export function StreakCounter({ progress }: StreakCounterProps) {
  const { current_streak, best_streak } = progress;
  const label = `Days in a row: ${current_streak} current, best ${best_streak}`;

  return (
    <div
      className="flex w-full max-w-[640px] items-center justify-between gap-3 rounded-[14px] border border-pink/35 bg-white/75 px-3 py-2 shadow-sm"
      data-testid="streak-counter"
      role="group"
      aria-label={label}
    >
      <div className="min-w-0">
        <p className="m-0 font-display text-[0.95rem] text-pink-ink">Days in a row</p>
        <p className="m-0 mt-0.5 font-ui text-[0.75rem] text-ink-soft">
          Best {best_streak} · keep showing up gently
        </p>
      </div>
      <div
        className="flex h-11 min-w-[2.75rem] items-center justify-center rounded-pill bg-gel-pink px-3 font-display text-[1.35rem] text-white shadow-sm"
        aria-hidden="true"
        data-testid="streak-current"
      >
        {current_streak}
      </div>
      <span className="sr-only">
        Current streak {current_streak}, best streak {best_streak}
      </span>
    </div>
  );
}
