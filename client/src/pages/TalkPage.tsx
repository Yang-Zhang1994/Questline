import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { createManualPlan } from '../api/goals';
import { ChatWindow } from '../components/ChatWindow/ChatWindow';
import { ManualPlanForm } from '../components/ManualPlanForm/ManualPlanForm';
import { MilestonePlanEditor } from '../components/MilestonePlanEditor/MilestonePlanEditor';
import { WeekPlanPreview } from '../components/WeekPlanPreview/WeekPlanPreview';
import { BottomDock } from '../components/BottomDock/BottomDock';
import { useChat } from '../hooks/useChat';
import { useGoals } from '../hooks/useGoals';
import { useMilestonePlan } from '../hooks/useMilestonePlan';
import { useWeekPlan } from '../hooks/useWeekPlan';

export type TalkPageProps = {
  userEmail?: string | null;
  onLogout?: () => void;
};

export function TalkPage({ userEmail = null, onLogout }: TalkPageProps) {
  const navigate = useNavigate();
  const {
    messages,
    interview,
    loading,
    sending,
    restarting,
    error,
    aiUnavailable: chatAiUnavailable,
    send,
    restart,
    reload,
    appendMessages,
    goalDraft,
    confirmedGoal,
    goalLoading,
    goalBusy,
    goalError,
    acceptGoal,
    reviseGoal,
    returnToInterview,
  } = useChat();
  const { beginNewGoal, busy: goalsBusy } = useGoals();
  const milestonePlan = useMilestonePlan({ onChatMessagesAdded: appendMessages });
  const weekPlan = useWeekPlan({ onChatMessagesAdded: appendMessages });
  const currentMilestone =
    weekPlan.milestone ??
    milestonePlan.savedMilestones.find((m) => m.status === 'current') ??
    null;

  const [showManualForm, setShowManualForm] = useState(false);
  const [aiFallback, setAiFallback] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // AC: offer the form automatically when the AI service returns an error
  useEffect(() => {
    if (chatAiUnavailable || milestonePlan.aiUnavailable) {
      setAiFallback(true);
      setShowManualForm(true);
    }
  }, [chatAiUnavailable, milestonePlan.aiUnavailable]);

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
          disabled={goalsBusy || restarting || sending || loading || manualBusy}
          onClick={() => {
            void (async () => {
              await beginNewGoal();
              milestonePlan.reset();
              weekPlan.reset();
              setShowManualForm(false);
              setAiFallback(false);
              setManualError(null);
              await reload();
              await milestonePlan.reload();
            })();
          }}
          className="rounded-pill bg-gel-pink px-3.5 py-2 text-[0.82rem] font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
        >
          ＋ New goal
        </button>
      </div>

      {showManualForm ? (
        <ManualPlanForm
          busy={manualBusy}
          error={manualError}
          aiFallbackNotice={aiFallback}
          onBackToChat={() => {
            setShowManualForm(false);
            setAiFallback(false);
            setManualError(null);
          }}
          onSubmit={async (values) => {
            setManualBusy(true);
            setManualError(null);
            try {
              await createManualPlan({
                title: values.title,
                concrete_goal: values.concrete_goal || null,
                deadline: values.deadline || null,
                milestones: values.milestones,
              });
              milestonePlan.reset();
              await milestonePlan.reload();
              navigate('/map');
            } catch (err) {
              setManualError(
                err instanceof Error ? err.message : 'Could not save your handwritten plan',
              );
            } finally {
              setManualBusy(false);
            }
          }}
        />
      ) : (
        <>
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
            goalDraft={goalDraft}
            confirmedGoal={confirmedGoal}
            goalLoading={goalLoading}
            goalBusy={goalBusy}
            goalError={goalError}
            onAcceptGoal={() => {
              void acceptGoal();
            }}
            onReviseGoal={(feedback) => {
              void reviseGoal(feedback);
            }}
            onReturnToInterview={() => {
              void returnToInterview();
            }}
          />

          <div className="relative z-[1] mt-3 flex w-full max-w-[640px] flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              data-testid="talk-write-plan-myself"
              onClick={() => {
                setAiFallback(false);
                setManualError(null);
                setShowManualForm(true);
              }}
              className="text-[0.9rem] font-bold text-blue-ink underline decoration-blue-ink/40 underline-offset-2 hover:decoration-blue-ink"
            >
              Write the plan myself
            </button>
          </div>

          <MilestonePlanEditor
            goal={milestonePlan.goal ?? confirmedGoal}
            draftMilestones={milestonePlan.draftMilestones}
            savedMilestones={milestonePlan.savedMilestones}
            proposing={milestonePlan.proposing}
            confirming={milestonePlan.confirming}
            confirmed={milestonePlan.confirmed}
            error={milestonePlan.error}
            onPropose={milestonePlan.propose}
            onAdjust={milestonePlan.adjust}
            onConfirm={milestonePlan.confirm}
          />

          <WeekPlanPreview
            goal={weekPlan.goal ?? milestonePlan.goal ?? confirmedGoal}
            milestone={currentMilestone}
            windowStart={weekPlan.windowStart}
            windowEnd={weekPlan.windowEnd}
            timeBudgetMinutesPerDay={weekPlan.timeBudgetMinutesPerDay}
            existingQuests={weekPlan.existingQuests}
            draftQuests={weekPlan.draftQuests}
            proposing={weekPlan.proposing}
            confirming={weekPlan.confirming}
            confirmed={weekPlan.confirmed}
            error={weekPlan.error}
            onPropose={weekPlan.propose}
            onAdjust={weekPlan.adjust}
            onConfirm={weekPlan.confirm}
          />
        </>
      )}

      <BottomDock />
    </div>
  );
}
