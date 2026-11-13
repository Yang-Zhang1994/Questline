import type { UserProgress } from '@questline/shared';

export type XpBarProps = {
  progress: UserProgress;
};

/**
 * HUD level + XP progress toward the next level (Issue #11).
 * Design: ★ Lv N + bar — colors from tokens; no invented palette.
 */
export function XpBar({ progress }: XpBarProps) {
  const { level, xp_into_level, xp_for_next_level, xp } = progress;
  const ratio = Math.min(1, Math.max(0, xp_into_level / xp_for_next_level));
  const percent = Math.round(ratio * 100);
  const label = `Level ${level}, ${xp_into_level} of ${xp_for_next_level} XP to next level`;

  return (
    <div
      className="flex w-full max-w-[640px] items-center gap-3 rounded-[14px] border border-pink/35 bg-white/75 px-3 py-2 shadow-sm"
      data-testid="xp-bar"
      role="group"
      aria-label={label}
    >
      <span className="shrink-0 font-display text-[0.95rem] text-pink-ink" aria-hidden="true">
        ★ Lv {level}
      </span>
      <span className="sr-only">Level {level}</span>
      <div className="min-w-0 flex-1">
        <div
          className="h-3 overflow-hidden rounded-pill bg-pink-pale"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={xp_for_next_level}
          aria-valuenow={xp_into_level}
          aria-label={`XP progress to level ${level + 1}`}
        >
          <div
            className="h-full rounded-pill bg-gel-pink transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
            data-testid="xp-bar-fill"
          />
        </div>
        <p className="mt-1 font-ui text-[0.75rem] text-ink-soft">
          {xp_into_level}/{xp_for_next_level} XP · total {xp}
        </p>
      </div>
    </div>
  );
}
