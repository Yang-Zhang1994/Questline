import { useNavigate } from 'react-router';
import { DailyNote } from '../components/DailyNote/DailyNote';
import { DiaryNoteCard } from '../components/DiaryNoteCard/DiaryNoteCard';
import { GoalCelebration } from '../components/GoalCelebration/GoalCelebration';
import { GoalSelector } from '../components/GoalSelector/GoalSelector';
import { LevelUpToast } from '../components/LevelUpToast/LevelUpToast';
import { PageShell } from '../components/PageShell/PageShell';
import { ReschedulePreview } from '../components/ReschedulePreview/ReschedulePreview';
import { StageCompletePrompt } from '../components/StageCompletePrompt/StageCompletePrompt';
import { StampCard } from '../components/StampCard/StampCard';
import { StreakCounter } from '../components/StreakCounter/StreakCounter';
import { XpBar } from '../components/XpBar/XpBar';
import { useDiaryNote } from '../hooks/useDiaryNote';
import { useGoals } from '../hooks/useGoals';
import { useReschedule } from '../hooks/useReschedule';
import { useStageAdvance } from '../hooks/useStageAdvance';
import { useTodayQuests } from '../hooks/useTodayQuests';
import { todayLocalDate } from '../lib/localDate';

export type TodayPageProps = {
  userEmail?: string | null;
  onLogout?: () => void;
};

export function TodayPage({ userEmail = null, onLogout }: TodayPageProps) {
  const navigate = useNavigate();
  const {
    status,
    goal,
    milestone,
    todayDate,
    todayQuests,
    earlierQuests,
    progress,
    stampCard,
    stageReady,
    stageReadyMilestone,
    levelUpMessage,
    dismissLevelUp,
    cardRewardMessage,
    dismissCardReward,
    error,
    pendingQuestIds,
    toggleError,
    toggleQuest,
    reload,
  } = useTodayQuests();

  const reschedule = useReschedule({
    onConfirmed: reload,
  });

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

  const {
    busy: stageBusy,
    error: stageError,
    result: stageResult,
    confirm: confirmStage,
    dismissResult: dismissStageResult,
  } = useStageAdvance();

  const diary = useDiaryNote({
    goalId: goal?.id ?? null,
    localDate: todayDate ?? todayLocalDate(),
  });

  const showStagePrompt = stageReady && stageReadyMilestone && !stageResult;
  const stageAdvanceToast =
    stageResult && !stageResult.goal_completed ? stageResult.mochi_message : null;

  return (
    <PageShell userEmail={userEmail} onLogout={onLogout}>
      <main className="flex w-full flex-col items-center gap-3">
        <GoalSelector
          goals={goals}
          activeGoalId={activeGoalId}
          loading={goalsLoading}
          busy={goalsBusy}
          error={goalsError}
          onSelect={async (goalId) => {
            await selectGoal(goalId);
            await reload();
          }}
          onNewGoal={async () => {
            await beginNewGoal();
            navigate('/talk');
          }}
          onDelete={async (goalId) => {
            await removeGoal(goalId);
            await reload();
          }}
        />

        {progress ? (
          <div className="relative z-[1] flex w-full max-w-[640px] flex-col gap-2">
            <XpBar progress={progress} />
            <StreakCounter progress={progress} />
          </div>
        ) : null}
        <DailyNote
          status={status}
          goal={goal}
          milestone={milestone}
          todayDate={todayDate}
          todayQuests={todayQuests}
          earlierQuests={earlierQuests}
          rescheduling={reschedule.proposing}
          onRescheduleRequest={() => {
            void reschedule.propose();
          }}
          error={error}
          pendingQuestIds={pendingQuestIds}
          toggleError={toggleError}
          onToggleQuest={(questId, completed) => {
            void toggleQuest(questId, completed);
          }}
          onRetry={() => {
            void reload();
          }}
        />

        <ReschedulePreview
          goal={reschedule.goal ?? goal}
          milestone={reschedule.milestone ?? milestone}
          windowStart={reschedule.windowStart}
          windowEnd={reschedule.windowEnd}
          timeBudgetMinutesPerDay={reschedule.timeBudgetMinutesPerDay}
          overdueQuests={reschedule.overdueQuests}
          existingQuests={reschedule.existingQuests}
          draftMoves={reschedule.draftMoves}
          mochiMessage={reschedule.mochiMessage}
          proposing={reschedule.proposing}
          confirming={reschedule.confirming}
          confirmed={reschedule.confirmed}
          error={reschedule.error}
          onPropose={reschedule.propose}
          onAdjust={reschedule.adjust}
          onConfirm={reschedule.confirm}
          onCancel={reschedule.reset}
        />

        {showStagePrompt && stageReadyMilestone ? (
          <StageCompletePrompt
            milestoneTitle={stageReadyMilestone.milestone_title}
            busy={stageBusy}
            error={stageError}
            onConfirm={() => {
              void (async () => {
                try {
                  await confirmStage(stageReadyMilestone.milestone_id);
                  await reload();
                } catch {
                  // Error surfaced via useStageAdvance.
                }
              })();
            }}
          />
        ) : null}

        {stampCard ? <StampCard stampCard={stampCard} /> : null}

        {goal ? (
          <DiaryNoteCard
            content={diary.content}
            loading={diary.loading}
            saveStatus={diary.saveStatus}
            saveError={diary.saveError}
            onChange={diary.updateContent}
            onBlur={diary.flushSave}
          />
        ) : null}
      </main>

      <LevelUpToast message={levelUpMessage} onDismiss={dismissLevelUp} />
      <LevelUpToast message={cardRewardMessage} onDismiss={dismissCardReward} />
      <LevelUpToast
        message={stageAdvanceToast}
        onDismiss={() => {
          dismissStageResult();
        }}
      />

      {stageResult?.goal_completed ? (
        <GoalCelebration
          goalTitle={stageResult.goal.title}
          message={stageResult.mochi_message}
          onDismiss={dismissStageResult}
        />
      ) : null}
    </PageShell>
  );
}
