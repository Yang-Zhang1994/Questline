import { ChatWindow } from '../components/ChatWindow/ChatWindow';
import { BottomDock } from '../components/BottomDock/BottomDock';
import { MilestonePlanEditor } from '../components/MilestonePlanEditor/MilestonePlanEditor';
import { QuestPlanEditor } from '../components/QuestPlanEditor/QuestPlanEditor';
import { useChat } from '../hooks/useChat';
import { useGoals } from '../hooks/useGoals';
import { useMilestonePlan } from '../hooks/useMilestonePlan';
import { useQuestPlan } from '../hooks/useQuestPlan';

export type TalkPageProps = {
  userEmail?: string | null;
  onLogout?: () => void;
};

export function TalkPage({ userEmail = null, onLogout }: TalkPageProps) {
  const { messages, interview, loading, sending, restarting, error, send, restart, reload } =
    useChat();
  const { beginNewGoal, busy: goalsBusy } = useGoals();
  const {
    draft: milestoneDraft,
    goal: milestoneGoal,
    savedMilestones,
    confirmed: milestonesConfirmed,
    loading: milestoneLoading,
    busy: milestoneBusy,
    error: milestoneError,
    confirm: confirmMilestones,
    revise: reviseMilestones,
    reset: resetMilestones,
  } = useMilestonePlan();

  const {
    draft: questDraft,
    goal: questGoal,
    milestone: questMilestone,
    savedQuests,
    confirmed: questsConfirmed,
    loading: questLoading,
    busy: questBusy,
    error: questError,
    confirm: confirmQuests,
    revise: reviseQuests,
    reload: reloadQuestPlan,
  } = useQuestPlan({
    enabled: milestonesConfirmed && savedMilestones.length > 0,
    autoPropose: true,
  });

  // Only surface the editor once we know there is an active goal (or a draft/saved plan).
  const showMilestoneEditor =
    milestoneDraft !== null ||
    (milestonesConfirmed && savedMilestones.length > 0) ||
    (milestoneLoading && milestoneGoal !== null);

  const showQuestEditor =
    milestonesConfirmed &&
    savedMilestones.length > 0 &&
    (questDraft !== null ||
      (questsConfirmed && savedQuests.length > 0) ||
      questLoading);

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

      <div className="relative z-[1] mb-3 flex w-full max-w-[640px] justify-end">
        <button
          type="button"
          data-testid="talk-new-goal"
          disabled={goalsBusy || restarting || sending || loading}
          onClick={() => {
            void (async () => {
              await beginNewGoal();
              resetMilestones();
              await reload();
              await reloadQuestPlan();
            })();
          }}
          className="rounded-pill bg-gel-pink px-4 py-2 text-[0.85rem] font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
        >
          ＋ New goal
        </button>
      </div>

      <ChatWindow
        messages={messages}
        interview={interview}
        loading={loading}
        sending={sending}
        restarting={restarting}
        error={error}
        onSend={(content) => {
          void send(content);
        }}
        onRestart={() => {
          void restart();
        }}
      />

      {showMilestoneEditor ? (
        <MilestonePlanEditor
          draft={milestoneDraft}
          goal={milestoneGoal}
          confirmedMilestones={milestonesConfirmed ? savedMilestones : []}
          loading={milestoneLoading}
          busy={milestoneBusy}
          error={milestoneError}
          onConfirm={() => {
            void confirmMilestones();
          }}
          onRevise={(feedback) => {
            void reviseMilestones(feedback);
          }}
        />
      ) : null}

      {showQuestEditor ? (
        <QuestPlanEditor
          draft={questDraft}
          goal={questGoal}
          milestone={questMilestone}
          confirmedQuests={questsConfirmed ? savedQuests : []}
          loading={questLoading}
          busy={questBusy}
          error={questError}
          onConfirm={() => {
            void confirmQuests();
          }}
          onRevise={(feedback) => {
            void reviseQuests(feedback);
          }}
        />
      ) : null}

      <BottomDock />
    </div>
  );
}
