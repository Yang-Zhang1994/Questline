import { useNavigate } from 'react-router';
import { BottomDock } from '../components/BottomDock/BottomDock';
import { DailyNote } from '../components/DailyNote/DailyNote';
import { DiaryNoteCard } from '../components/DiaryNoteCard/DiaryNoteCard';
import { GoalCelebration } from '../components/GoalCelebration/GoalCelebration';
import { GoalSelector } from '../components/GoalSelector/GoalSelector';
import { LevelUpToast } from '../components/LevelUpToast/LevelUpToast';
import { StageCompletePrompt } from '../components/StageCompletePrompt/StageCompletePrompt';
import { StreakCounter } from '../components/StreakCounter/StreakCounter';
import { XpBar } from '../components/XpBar/XpBar';
import { useDiaryNote } from '../hooks/useDiaryNote';
import { useGoals } from '../hooks/useGoals';
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
    progress,
    stageReady,
    stageReadyMilestone,
    levelUpMessage,
    dismissLevelUp,
    error,
    pendingQuestIds,
    toggleError,
    toggleQuest,
    reload,
  } = useTodayQuests();

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
    <div className="flex min-h-screen flex-col items-center px-4 pb-24 pt-6">
      <div
        className="pointer-events-none fixed inset-0 bg-sparkles opacity-70 animate-twinkle"
        aria-hidden="true"
      />
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
                <p
                  className="m-0 max-w-[10rem] truncate text-[0.75rem] text-ink-soft"
                  title={userEmail}
                >
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

      <BottomDock />
    </div>
  );
}
