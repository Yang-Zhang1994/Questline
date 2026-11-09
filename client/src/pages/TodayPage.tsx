import { DailyNote } from '../components/DailyNote/DailyNote';
import { useDailyQuests } from '../hooks/useDailyQuests';

export function TodayPage() {
  const { data, loading, error, busyQuestId, toggleQuest } = useDailyQuests();

  return (
    <div className="flex min-h-screen flex-col items-center px-4 pb-24 pt-6">
      <div className="pointer-events-none fixed inset-0 bg-sparkles opacity-70 animate-twinkle" aria-hidden="true" />
      <header className="mb-5 animate-soft-bob text-center motion-reduce:animate-none">
        <h1 className="m-0 bg-brand-title bg-clip-text-fill font-display text-[clamp(2rem,5vw,2.8rem)]">
          Questline
        </h1>
        <p className="mt-1 text-[0.95rem] text-ink-soft">your little quest diary with Mochi ♡</p>
      </header>

      <DailyNote
        data={data}
        loading={loading}
        error={error}
        busyQuestId={busyQuestId}
        onToggleQuest={(questId, completed) => {
          void toggleQuest(questId, completed);
        }}
      />

      <nav
        className="fixed bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-pill bg-white/92 p-[0.45rem] shadow-dock"
        aria-label="Main"
      >
        <button
          type="button"
          className="cursor-default rounded-pill bg-gel-pink px-[1.1rem] py-[0.65rem] font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)]"
        >
          ☀️ Today
        </button>
        <button
          type="button"
          className="cursor-default rounded-pill bg-transparent px-[1.1rem] py-[0.65rem] font-bold text-blue-ink"
          disabled
        >
          🗺️ Map
        </button>
        <button
          type="button"
          className="cursor-default rounded-pill bg-transparent px-[1.1rem] py-[0.65rem] font-bold text-blue-ink"
          disabled
        >
          💌 Talk
        </button>
      </nav>
    </div>
  );
}
