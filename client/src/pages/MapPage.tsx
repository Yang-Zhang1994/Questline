import { Link } from 'react-router';
import { BottomDock } from '../components/BottomDock/BottomDock';
import { MochiAvatar } from '../components/MochiAvatar';
import { RoadmapView } from '../components/RoadmapView/RoadmapView';
import { useRoadmap } from '../hooks/useRoadmap';

export type MapPageProps = {
  userEmail?: string | null;
  onLogout?: () => void;
};

export function MapPage({ userEmail = null, onLogout }: MapPageProps) {
  const { goal, milestones, confirmed, loading, error } = useRoadmap();
  const hasMap = confirmed && goal != null && milestones.length > 0;

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

      {loading && !hasMap ? (
        <section
          className="w-full max-w-[640px] rounded-window border-[3px] border-pink/40 bg-purple-pale px-4 py-6 text-center shadow-window"
          aria-busy="true"
          aria-label="Loading your map"
          data-testid="map-loading"
        >
          <p className="m-0 text-[0.95rem] text-ink-soft">Mochi is unrolling your map…</p>
        </section>
      ) : null}

      {!loading && error ? (
        <p className="mb-3 w-full max-w-[640px] text-center text-[0.9rem] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && !hasMap ? (
        <section
          className="w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink bg-pink-pale shadow-window animate-rise-in"
          aria-label="A note from Mochi"
          data-testid="map-empty"
        >
          <header className="flex items-center justify-between gap-3 bg-gel-pink px-4 py-[0.7rem] font-display text-[1.05rem] tracking-[0.01em] text-white">
            <span className="inline-flex items-center gap-1.5">✉ A note from Mochi</span>
            <span className="inline-flex gap-1 text-[0.85rem] opacity-90" aria-hidden="true">
              ♡ ♡
            </span>
          </header>
          <div className="grid grid-cols-1 gap-4 bg-note-lines px-[1.15rem] pb-5 pt-[1.1rem] sm:grid-cols-[auto_1fr]">
            <div className="w-24 justify-self-center self-start rounded-lg bg-panel p-[0.45rem] pb-[1.1rem] shadow-polaroid -rotate-1 sm:justify-self-auto sm:-rotate-[3deg] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full">
              <MochiAvatar mood="wink" />
            </div>
            <div className="min-w-0">
              <p className="mb-4 font-bold leading-[1.45] text-blue-ink">
                Your map is still blank! Tell me what you&apos;d like to achieve and I&apos;ll draw the road
                from here to there.
              </p>
              <Link
                to="/talk"
                className="inline-flex items-center justify-center rounded-pill bg-gel-pink px-5 py-2.5 font-bold text-white no-underline shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-105"
              >
                ♡ Plan a quest with Mochi
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {hasMap && goal ? <RoadmapView goal={goal} milestones={milestones} /> : null}

      <BottomDock />
    </div>
  );
}
