import type { Quest, TodayQuestsResponse } from '@questline/shared';
import { MochiAvatar } from '../MochiAvatar';
import { QuestItem } from '../QuestItem/QuestItem';

export type DailyNoteProps = {
  data: TodayQuestsResponse | null;
  loading?: boolean;
  error?: string | null;
  busyQuestId?: number | null;
  /** When true, offer planning quests for the current milestone (Issue #7). */
  canPlanQuests?: boolean;
  onPlanQuests?: () => void;
  /** When true, offer reshuffling overdue quests (Issue #14). */
  canReschedule?: boolean;
  onReschedule?: () => void;
  onToggleQuest: (questId: number, completed: boolean) => void;
};

export function DailyNote({
  data,
  loading = false,
  error = null,
  busyQuestId = null,
  canPlanQuests = false,
  onPlanQuests,
  canReschedule = false,
  onReschedule,
  onToggleQuest,
}: DailyNoteProps) {
  const emptyToday = Boolean(data && data.quests.length === 0);
  const overdue = data?.overdue_quests ?? [];
  const hasOverdue = overdue.length > 0;

  return (
    <section
      className="w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink bg-pink-pale shadow-window animate-rise-in"
      aria-label="A note from Mochi"
    >
      <header className="flex items-center justify-between gap-3 bg-gel-pink px-4 py-[0.7rem] font-display text-[1.05rem] tracking-[0.01em] text-white">
        <span className="inline-flex items-center gap-1.5">✉ A note from Mochi</span>
        <span className="inline-flex gap-1 text-[0.85rem] opacity-90" aria-hidden="true">
          ♡ ♡
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 bg-note-lines px-[1.15rem] pb-5 pt-[1.1rem] sm:grid-cols-[auto_1fr]">
        <div className="w-24 justify-self-center self-start rounded-lg bg-panel p-[0.45rem] pb-[1.1rem] shadow-polaroid -rotate-1 sm:justify-self-auto sm:-rotate-[3deg] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full">
          <MochiAvatar
            mood={
              data && data.done_count === data.total_count && data.total_count > 0
                ? 'wink'
                : 'happy'
            }
          />
        </div>

        <div className="min-w-0">
          {loading && !data ? (
            <p className="mb-3 font-bold leading-[1.45] text-blue-ink">
              Mochi is writing today&apos;s note…
            </p>
          ) : null}

          {data ? (
            <>
              <p className="mb-3 font-bold leading-[1.45] text-blue-ink">{data.greeting}</p>
              {data.milestone_title ? (
                <p className="mb-[0.85rem] text-[0.92rem] text-ink-soft">
                  Current milestone: <strong>{data.milestone_title}</strong>
                </p>
              ) : null}
              {data.total_count > 0 ? (
                <p className="mb-3 font-ui text-[0.85rem] font-bold text-pink-ink">
                  Today&apos;s quests · {data.done_count}/{data.total_count} done
                </p>
              ) : null}

              {hasOverdue ? (
                <div className="mb-3" data-testid="overdue-quests">
                  <p className="mb-2 font-ui text-[0.85rem] font-bold text-pink-ink">
                    Soft leftovers · {overdue.length} still waiting
                  </p>
                  <ul className="m-0 flex list-none flex-col gap-[0.55rem] p-0">
                    {overdue.map((quest: Quest) => (
                      <QuestItem
                        key={quest.id}
                        quest={quest}
                        overdue
                        disabled={busyQuestId === quest.id}
                        onToggle={onToggleQuest}
                      />
                    ))}
                  </ul>
                  {canReschedule && onReschedule ? (
                    <button
                      type="button"
                      onClick={onReschedule}
                      className="mt-3 inline-flex items-center justify-center rounded-pill bg-blue-ink px-4 py-2 text-[0.88rem] font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.35)] hover:brightness-105"
                      data-testid="reschedule-cta"
                    >
                      Too much? Let&apos;s adjust together
                    </button>
                  ) : null}
                </div>
              ) : null}

              {emptyToday ? (
                <div>
                  <p className="m-0 text-ink-soft">
                    {canPlanQuests
                      ? 'No quests lined up yet for this stage — want me to sketch a few tiny ones?'
                      : 'No quests for today — enjoy a soft rest day.'}
                  </p>
                  {canPlanQuests && onPlanQuests ? (
                    <button
                      type="button"
                      onClick={onPlanQuests}
                      className="mt-3 inline-flex items-center justify-center rounded-pill bg-gel-pink px-4 py-2 text-[0.88rem] font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-105"
                      data-testid="plan-quests-cta"
                    >
                      ♡ Plan my next days
                    </button>
                  ) : null}
                </div>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-[0.55rem] p-0">
                  {data.quests.map((quest: Quest) => (
                    <QuestItem
                      key={quest.id}
                      quest={quest}
                      disabled={busyQuestId === quest.id}
                      onToggle={onToggleQuest}
                    />
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {error ? (
            <p className="mt-2 text-[0.9rem] text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
