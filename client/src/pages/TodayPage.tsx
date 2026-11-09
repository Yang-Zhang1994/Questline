import { useEffect, useState } from 'react';
import { DailyNote } from '../components/DailyNote/DailyNote';
import { BottomDock } from '../components/BottomDock/BottomDock';
import { LevelUpToast } from '../components/LevelUpToast/LevelUpToast';
import { QuestPlanEditor } from '../components/QuestPlanEditor/QuestPlanEditor';
import { StreakCounter } from '../components/StreakCounter/StreakCounter';
import { XpBar } from '../components/XpBar/XpBar';
import { useDailyQuests } from '../hooks/useDailyQuests';
import { useQuestPlan } from '../hooks/useQuestPlan';

export type TodayPageProps = {
  userEmail?: string | null;
  onLogout?: () => void;
};

export function TodayPage({ userEmail = null, onLogout }: TodayPageProps) {
  const {
    data,
    loading,
    error,
    busyQuestId,
    levelUpMessage,
    dismissLevelUp,
    toggleQuest,
    reload,
  } = useDailyQuests();
  const [planning, setPlanning] = useState(false);

  // Probe whether the current milestone already has saved quests (without auto-propose).
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
    propose: proposeQuests,
    reload: reloadQuestPlan,
  } = useQuestPlan({
    enabled: Boolean(data?.milestone_title) || planning,
    autoPropose: false,
  });

  // Once the user asks to plan, load/propose a draft.
  useEffect(() => {
    if (!planning) return;
    if (questDraft || questsConfirmed) return;
    if (questLoading || questBusy) return;
    void proposeQuests();
  }, [planning, questDraft, questsConfirmed, questLoading, questBusy, proposeQuests]);

  const milestoneHasNoQuests =
    Boolean(questMilestone) && !questsConfirmed && savedQuests.length === 0 && !questLoading;

  const showPlanCta =
    Boolean(data && data.quests.length === 0 && data.milestone_title) &&
    milestoneHasNoQuests &&
    !planning;

  const showEditor = planning || Boolean(questDraft);

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

      {data?.progress ? (
        <div className="relative z-[1] mb-4 flex w-full max-w-[640px] flex-col gap-2">
          <XpBar progress={data.progress} />
          <StreakCounter progress={data.progress} />
        </div>
      ) : null}

      <DailyNote
        data={data}
        loading={loading}
        error={error}
        busyQuestId={busyQuestId}
        canPlanQuests={showPlanCta}
        onPlanQuests={() => {
          setPlanning(true);
        }}
        onToggleQuest={(questId, completed) => {
          void toggleQuest(questId, completed);
        }}
      />

      <LevelUpToast message={levelUpMessage} onDismiss={dismissLevelUp} />

      {showEditor ? (
        <QuestPlanEditor
          draft={questDraft}
          goal={questGoal}
          milestone={questMilestone}
          confirmedQuests={questsConfirmed ? savedQuests : []}
          loading={questLoading || (planning && !questDraft && !questsConfirmed)}
          busy={questBusy}
          error={questError}
          onConfirm={async () => {
            await confirmQuests();
            setPlanning(false);
            await reload();
            await reloadQuestPlan();
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
