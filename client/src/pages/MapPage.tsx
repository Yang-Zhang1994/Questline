import { RoadmapView } from '../components/RoadmapView/RoadmapView';
import { BottomDock } from '../components/BottomDock/BottomDock';
import { useRoadmap } from '../hooks/useRoadmap';

export type MapPageProps = {
  userEmail?: string | null;
  onLogout?: () => void;
};

export function MapPage({ userEmail = null, onLogout }: MapPageProps) {
  const { data, loading, error } = useRoadmap();

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

      <main className="w-full flex justify-center">
        <RoadmapView
          goal={data?.goal ?? null}
          milestones={data?.milestones ?? []}
          loading={loading}
          error={error}
        />
      </main>

      <BottomDock />
    </div>
  );
}
