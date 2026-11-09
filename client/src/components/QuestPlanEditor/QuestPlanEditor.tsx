import { useState } from 'react';
import type {
  Milestone,
  MilestoneGoalSummary,
  Quest,
  QuestPlanDraft,
} from '@questline/shared';

export type QuestPlanEditorProps = {
  draft: QuestPlanDraft | null;
  goal?: MilestoneGoalSummary | null;
  milestone?: Milestone | null;
  confirmedQuests?: Quest[];
  loading?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onRevise: (feedback?: string) => void | Promise<void>;
};

function groupByDueDate(draft: QuestPlanDraft) {
  const map = new Map<string, QuestPlanDraft['quests']>();
  for (const quest of draft.quests) {
    const list = map.get(quest.due_date) ?? [];
    list.push(quest);
    map.set(quest.due_date, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Confirm-before-save editor for Mochi's daily quest draft (Issue #7).
 */
export function QuestPlanEditor({
  draft,
  goal = null,
  milestone = null,
  confirmedQuests = [],
  loading = false,
  busy = false,
  error = null,
  onConfirm,
  onRevise,
}: QuestPlanEditorProps) {
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  if (confirmedQuests.length > 0 && !draft) {
    return (
      <section
        className="mt-4 w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink bg-meadow/60 shadow-window animate-rise-in"
        data-testid="quest-plan-editor"
        aria-label="Quest plan saved"
      >
        <header className="bg-gel-pink px-4 py-[0.65rem] font-display text-[1rem] text-white">
          ✦ Daily quests saved
        </header>
        <div className="px-4 py-3">
          {milestone ? (
            <p className="m-0 text-[0.9rem] font-bold text-ink" data-testid="quest-plan-milestone">
              For stage: {milestone.title}
            </p>
          ) : null}
          <ul className="mt-2 m-0 list-none space-y-2 p-0" data-testid="quest-saved-list">
            {confirmedQuests.map((item) => (
              <li
                key={item.id}
                className="rounded-[14px] bg-panel/80 px-3 py-2 text-[0.88rem] text-ink"
                data-testid={`quest-saved-${item.id}`}
              >
                <span className="font-bold">{item.title}</span>
                <span className="mt-0.5 block text-[0.78rem] text-ink-soft">
                  Due {item.due_date}
                  {item.estimated_minutes != null ? ` · ~${item.estimated_minutes} min` : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 m-0 text-[0.82rem] text-ink-soft">
            Peek at Today whenever you&apos;re ready — Mochi will only show what&apos;s due.
          </p>
        </div>
      </section>
    );
  }

  if (loading && !draft) {
    return (
      <section
        className="mt-4 w-full max-w-[640px] rounded-window border-[3px] border-pink/40 bg-purple-pale px-4 py-4 text-center shadow-window"
        data-testid="quest-plan-editor"
        aria-busy="true"
        aria-label="Drafting your daily quests"
      >
        <p className="m-0 text-[0.9rem] text-ink-soft">Mochi is sketching tiny daily quests…</p>
      </section>
    );
  }

  if (!draft) {
    return null;
  }

  const days = groupByDueDate(draft);
  const budget = goal?.time_budget_minutes_per_day ?? null;

  return (
    <section
      className="mt-4 w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink bg-purple-pale shadow-window animate-rise-in"
      data-testid="quest-plan-editor"
      aria-label="Edit your daily quest plan"
    >
      <header className="bg-gel-pink px-4 py-[0.65rem] font-display text-[1rem] text-white">
        ✦ Daily quests
      </header>
      <div className="px-4 py-3">
        {milestone ? (
          <p className="m-0 text-[0.85rem] text-ink-soft">
            For stage{' '}
            <span className="font-bold text-ink" data-testid="quest-plan-milestone">
              {milestone.title}
            </span>
            {budget != null ? (
              <>
                {' '}
                ·{' '}
                <span data-testid="quest-plan-budget">{budget} min/day</span>
              </>
            ) : null}
          </p>
        ) : null}

        <ol className="mt-3 m-0 list-none space-y-3 p-0" data-testid="quest-draft-days">
          {days.map(([dueDate, quests]) => {
            const dayTotal = quests.reduce((sum, q) => sum + q.estimated_minutes, 0);
            return (
              <li
                key={dueDate}
                className="rounded-[14px] border border-pink/20 bg-panel px-3 py-2"
                data-testid={`quest-draft-day-${dueDate}`}
              >
                <p className="m-0 font-display text-[0.9rem] text-pink-ink">
                  {dueDate}
                  <span className="ml-2 font-ui text-[0.78rem] font-bold text-blue-ink">
                    {dayTotal} min
                  </span>
                </p>
                <ul className="mt-1.5 m-0 list-none space-y-1.5 p-0">
                  {quests.map((quest, index) => (
                    <li
                      key={`${dueDate}-${quest.title}-${index}`}
                      className="text-[0.88rem] text-ink"
                      data-testid={`quest-draft-item-${dueDate}-${index}`}
                    >
                      <span className="font-bold">{quest.title}</span>
                      <span className="ml-1.5 text-[0.78rem] text-ink-soft">
                        ~{quest.estimated_minutes} min
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>

        <p
          className="mt-3 m-0 text-[0.88rem] text-ink"
          data-testid="quest-draft-mochi-message"
        >
          {draft.mochi_message}
        </p>

        {error ? (
          <p className="mt-2 m-0 text-[0.85rem] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {showFeedback ? (
          <label className="mt-3 block">
            <span className="sr-only">Tell Mochi how to edit the quests</span>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={busy}
              rows={2}
              placeholder="e.g. lighter Monday, rename the first quest…"
              className="w-full resize-none rounded-[14px] border-2 border-pink/25 bg-panel px-3 py-2 text-[0.9rem] text-ink outline-none focus:border-pink"
              data-testid="quest-revise-feedback"
            />
          </label>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void onConfirm();
            }}
            className="rounded-pill bg-gel-pink px-4 py-2 text-[0.88rem] font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] disabled:cursor-not-allowed disabled:opacity-55"
            data-testid="quest-confirm"
          >
            ★ Looks good — save my quests
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!showFeedback) {
                setShowFeedback(true);
                return;
              }
              void (async () => {
                await onRevise(feedback.trim() || undefined);
                setFeedback('');
                setShowFeedback(false);
              })();
            }}
            className="rounded-pill bg-blue-ink px-4 py-2 text-[0.88rem] font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
            data-testid="quest-revise"
          >
            {showFeedback ? 'Ask Mochi to edit' : 'Edit with Mochi'}
          </button>
        </div>
      </div>
    </section>
  );
}
