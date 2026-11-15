import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { createManualPlan } from '../api/goals';
import { ChatWindow } from '../components/ChatWindow/ChatWindow';
import { ManualPlanForm } from '../components/ManualPlanForm/ManualPlanForm';
import { MilestonePlanEditor } from '../components/MilestonePlanEditor/MilestonePlanEditor';
import { PageShell } from '../components/PageShell/PageShell';
import { WeekPlanPreview } from '../components/WeekPlanPreview/WeekPlanPreview';
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
    <PageShell userEmail={userEmail} onLogout={onLogout}>
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
    </PageShell>
  );
}
