import { BottomDock } from '../components/BottomDock/BottomDock';

export type TodayPageProps = {
  userEmail?: string | null;
  onLogout?: () => void;
};

/**
 * Today shell after revert of Issues #8 / #9.
 * Greeting note + quest check-off removed so Yanni can re-own those issues.
 * JWT session chrome and Talk dock remain.
 */
export function TodayPage({ userEmail = null, onLogout }: TodayPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 pb-24 pt-6">
      <div className="pointer-events-none fixed inset-0 bg-sparkles opacity-70 animate-twinkle" aria-hidden="true" />
      <header className="relative z-[1] mb-5 w-full max-w-[640px] animate-soft-bob text-center motion-reduce:animate-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="m-0 bg-brand-title bg-clip-text-fill font-display text-[clamp(2rem,5vw,2.8rem)]">
              Questline
            </h1>
            <p className="mt-1 text-[0.95rem] text-ink-soft">your little quest diary with Mochi ♡</p>
          </div>
          {onLogout ? (
            <div className="shrink-0 text-right">
              {userEmail ? (
                <p className="m-0 max-w-[10rem] truncate text-[0.75rem] text-ink-soft" title={userEmail}>
                  {userEmail}
                </p>
              ) : null}
              <button
                type="button"
                onClick={onLogout}
                className="mt-1 rounded-pill bg-white/90 px-3 py-1.5 text-[0.8rem] font-bold text-blue-ink shadow-sm hover:bg-white"
              >
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <section
        className="relative z-[1] w-full max-w-[640px] rounded-window border-[3px] border-pink bg-pink-pale px-5 py-6 text-center shadow-window"
        aria-label="Today placeholder"
      >
        <p className="m-0 font-display text-[1.15rem] text-ink">Today&apos;s quests are paused</p>
        <p className="mt-2 text-[0.95rem] text-ink-soft">
          Mochi&apos;s greeting note and quest check-off were reverted so Issue #8 / #9 can be
          reimplemented. Talk still works — come say hi.
        </p>
      </section>

      <BottomDock />
    </div>
  );
}
