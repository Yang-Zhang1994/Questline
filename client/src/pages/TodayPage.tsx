import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { DailyNote } from '../components/DailyNote/DailyNote';
import { BottomDock } from '../components/BottomDock/BottomDock';
import { GoalCelebration } from '../components/GoalCelebration/GoalCelebration';
import { GoalSelector } from '../components/GoalSelector/GoalSelector';
import { LevelUpToast } from '../components/LevelUpToast/LevelUpToast';
import { QuestPlanEditor } from '../components/QuestPlanEditor/QuestPlanEditor';
import { ReschedulePreview } from '../components/ReschedulePreview/ReschedulePreview';
import { StageCompletePrompt } from '../components/StageCompletePrompt/StageCompletePrompt';
import { StampCard } from '../components/StampCard/StampCard';
import { StreakCounter } from '../components/StreakCounter/StreakCounter';
import { WeekPlanPreview } from '../components/WeekPlanPreview/WeekPlanPreview';
import { XpBar } from '../components/XpBar/XpBar';
import { useDailyQuests } from '../hooks/useDailyQuests';
import { useGoals } from '../hooks/useGoals';
import { useQuestPlan } from '../hooks/useQuestPlan';
import { useReschedule } from '../hooks/useReschedule';
import { useStageAdvance } from '../hooks/useStageAdvance';
import { useWeekPlan } from '../hooks/useWeekPlan';

export type TodayPageProps = {
  userEmail?: string | null;
  onLogout?: () => void;
};

export function TodayPage({ userEmail = null, onLogout }: TodayPageProps) {
  const navigate = useNavigate();
  const {
    data,
    loading,
    error,
    busyQuestId,
    levelUpMessage,
    dismissLevelUp,
    stampRewardMessage,
    dismissStampReward,
    toggleQuest,
    reload,
  } = useDailyQuests();
  const {
    goals,
    activeGoalId,
    loading: goalsLoading,
    busy: goalsBusy,
    error: goalsError,
    selectGoal,
    beginNewGoal,
    removeGoal,
  } = useGoals();
  const [planning, setPlanning] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [weekPlanning, setWeekPlanning] = useState(false);

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

  const {
    draft: rescheduleDraft,
    overdue,
    goal: rescheduleGoal,
    milestone: rescheduleMilestone,
    loading: rescheduleLoading,
    busy: rescheduleBusy,
    error: rescheduleError,
    propose: proposeReschedule,
    revise: reviseReschedule,
    confirm: confirmReschedule,
    reload: reloadReschedule,
  } = useReschedule({
    enabled: Boolean(data?.overdue_quests?.length) || rescheduling,
    localDate: data?.local_date,
  });

  const {
    draft: weekPlanDraft,
    goal: weekPlanGoal,
    milestone: weekPlanMilestone,
    loading: weekPlanLoading,
    busy: weekPlanBusy,
    error: weekPlanError,
    propose: proposeWeekPlan,
    revise: reviseWeekPlan,
    confirm: confirmWeekPlan,
    reload: reloadWeekPlan,
  } = useWeekPlan({
    enabled: Boolean(data?.milestone_title) || weekPlanning,
    localDate: data?.local_date,
  });

  const {
    busy: stageBusy,
    error: stageError,
    result: stageResult,
    confirm: confirmStage,
    dismissResult: dismissStageResult,
  } = useStageAdvance();

  // Once the user asks to plan, load/propose a draft.
  useEffect(() => {
    if (!planning) return;
    if (questDraft || questsConfirmed) return;
    if (questLoading || questBusy) return;
    void proposeQuests();
  }, [planning, questDraft, questsConfirmed, questLoading, questBusy, proposeQuests]);

  // Once the user asks to reschedule, propose a preview (never auto-write dates).
  useEffect(() => {
    if (!rescheduling) return;
    if (rescheduleDraft) return;
    if (rescheduleLoading || rescheduleBusy) return;
    if ((data?.overdue_quests?.length ?? 0) === 0 && overdue.length === 0) return;
    void proposeReschedule();
  }, [
    rescheduling,
    rescheduleDraft,
    rescheduleLoading,
    rescheduleBusy,
    data?.overdue_quests?.length,
    overdue.length,
    proposeReschedule,
  ]);

  // Once the user asks for a week plan, propose a preview (never auto-write quests).
  useEffect(() => {
    if (!weekPlanning) return;
    if (weekPlanDraft) return;
    if (weekPlanLoading || weekPlanBusy) return;
    void proposeWeekPlan();
  }, [weekPlanning, weekPlanDraft, weekPlanLoading, weekPlanBusy, proposeWeekPlan]);

  const milestoneHasNoQuests =
    Boolean(questMilestone) && !questsConfirmed && savedQuests.length === 0 && !questLoading;

  const showPlanCta =
    Boolean(data && data.quests.length === 0 && data.milestone_title) &&
    milestoneHasNoQuests &&
    !planning;

  const showEditor = planning || Boolean(questDraft);
  const showRescheduleCta =
    Boolean(data?.overdue_quests?.length) && !rescheduling && !rescheduleDraft;
  const showReschedulePreview = rescheduling || Boolean(rescheduleDraft);
  // Week plan once the stage already has quests (initial plan is Issue #7).
  const showWeekPlanCta =
    Boolean(data?.milestone_title) &&
    (questsConfirmed || savedQuests.length > 0) &&
    !weekPlanning &&
    !weekPlanDraft &&
    !showEditor;
  const showWeekPlanPreview = weekPlanning || Boolean(weekPlanDraft);

  const showStagePrompt =
    Boolean(data?.stage_ready && data.stage_ready_milestone) &&
    !stageResult &&
    !showEditor &&
    !showReschedulePreview &&
    !showWeekPlanPreview;

  const stageAdvanceToast =
    stageResult && !stageResult.goal_completed ? stageResult.mochi_message : null;

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

      <div className="relative z-[1] mb-4 flex w-full max-w-[640px] flex-col gap-2">
        <GoalSelector
          goals={goals}
          activeGoalId={activeGoalId}
          loading={goalsLoading}
          busy={goalsBusy}
          error={goalsError}
          onSelect={async (goalId) => {
            await selectGoal(goalId);
            setPlanning(false);
            setRescheduling(false);
            setWeekPlanning(false);
            await reload();
          }}
          onNewGoal={async () => {
            await beginNewGoal();
            setPlanning(false);
            setRescheduling(false);
            setWeekPlanning(false);
            await reload();
            navigate('/talk');
          }}
          onDelete={async (goalId) => {
            await removeGoal(goalId);
            setPlanning(false);
            setRescheduling(false);
            setWeekPlanning(false);
            await reload();
          }}
        />
        {data?.progress ? (
          <>
            <XpBar progress={data.progress} />
            <StreakCounter progress={data.progress} />
            {data.stamp_card ? <StampCard stampCard={data.stamp_card} /> : null}
          </>
        ) : null}
      </div>

      <DailyNote
        data={data}
        loading={loading}
        error={error}
        busyQuestId={busyQuestId}
        canPlanQuests={showPlanCta}
        onPlanQuests={() => {
          setPlanning(true);
        }}
        canReschedule={showRescheduleCta}
        onReschedule={() => {
          setRescheduling(true);
        }}
        canWeekPlan={showWeekPlanCta}
        onWeekPlan={() => {
          setWeekPlanning(true);
        }}
        onToggleQuest={(questId, completed) => {
          void toggleQuest(questId, completed);
        }}
      />

      <LevelUpToast message={levelUpMessage} onDismiss={dismissLevelUp} />
      <LevelUpToast message={stampRewardMessage} onDismiss={dismissStampReward} />
      <LevelUpToast
        message={stageAdvanceToast}
        onDismiss={() => {
          dismissStageResult();
        }}
      />

      {showStagePrompt && data?.stage_ready_milestone ? (
        <StageCompletePrompt
          milestoneTitle={data.stage_ready_milestone.milestone_title}
          busy={stageBusy}
          error={stageError}
          onConfirm={() => {
            void (async () => {
              try {
                await confirmStage(data.stage_ready_milestone!.milestone_id);
                setPlanning(false);
                setWeekPlanning(false);
                await reload();
                await reloadQuestPlan();
              } catch {
                // Error surfaced via useStageAdvance.
              }
            })();
          }}
        />
      ) : null}

      {stageResult?.goal_completed ? (
        <GoalCelebration
          goalTitle={stageResult.goal.title}
          message={stageResult.mochi_message}
          onDismiss={dismissStageResult}
        />
      ) : null}

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

      {showReschedulePreview ? (
        <ReschedulePreview
          draft={rescheduleDraft}
          goal={rescheduleGoal}
          milestone={rescheduleMilestone}
          loading={rescheduleLoading || (rescheduling && !rescheduleDraft)}
          busy={rescheduleBusy}
          error={rescheduleError}
          onDismiss={() => {
            setRescheduling(false);
          }}
          onConfirm={async () => {
            await confirmReschedule();
            setRescheduling(false);
            await reload();
            await reloadReschedule();
          }}
          onRevise={(feedback) => {
            void reviseReschedule(feedback);
          }}
        />
      ) : null}

      {showWeekPlanPreview ? (
        <WeekPlanPreview
          draft={weekPlanDraft}
          goal={weekPlanGoal}
          milestone={weekPlanMilestone}
          loading={weekPlanLoading || (weekPlanning && !weekPlanDraft)}
          busy={weekPlanBusy}
          error={weekPlanError}
          onDismiss={() => {
            setWeekPlanning(false);
          }}
          onConfirm={async () => {
            await confirmWeekPlan();
            setWeekPlanning(false);
            await reload();
            await reloadWeekPlan();
            await reloadQuestPlan();
          }}
          onRevise={(feedback) => {
            void reviseWeekPlan(feedback);
          }}
        />
      ) : null}

      <BottomDock />
    </div>
  );
}
