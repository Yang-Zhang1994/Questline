import { useEffect, useId, useRef, useState } from 'react';
import {
  createManualQuestBodySchema,
  type Milestone,
  type Quest,
} from '@questline/shared';
import {
  FRIENDLY_CREATE_QUEST_ERROR,
  FRIENDLY_DELETE_QUEST_ERROR,
  FRIENDLY_MILESTONE_QUESTS_ERROR,
  createQuest,
  deleteQuest,
  fetchMilestoneQuests,
} from '../../api/quests';
import { todayLocalDate } from '../../lib/localDate';

export type MilestoneSheetProps = {
  milestone: Milestone | null;
  timeBudgetMinutesPerDay?: number | null;
  onClose: () => void;
  onQuestsChanged?: () => void;
};

const DEFAULT_DAILY_BUDGET = 30;

function toFriendlyError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const trimmed = err.message.trim();
  if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return fallback;
  }
  return trimmed;
}

export function MilestoneSheet({
  milestone,
  timeBudgetMinutesPerDay = null,
  onClose,
  onQuestsChanged,
}: MilestoneSheetProps) {
  const titleId = useId();
  const descId = useId();
  const newQuestInputId = useId();
  const dueDateInputId = useId();
  const minutesInputId = useId();

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resolvedBudget, setResolvedBudget] = useState<number>(
    timeBudgetMinutesPerDay && timeBudgetMinutesPerDay > 0
      ? timeBudgetMinutesPerDay
      : DEFAULT_DAILY_BUDGET,
  );

  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState(() => todayLocalDate());
  const [newMinutes, setNewMinutes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [budgetNote, setBudgetNote] = useState<string | null>(null);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!milestone) return;

    // Remember the element that had focus before opening the sheet
    if (document.activeElement instanceof HTMLElement) {
      triggerElementRef.current = document.activeElement;
    }

    setNewTitle('');
    setNewDueDate(todayLocalDate());
    setNewMinutes('');
    setFormError(null);
    setBudgetNote(null);
    setConfirmingDeleteId(null);
    setDeleteError(null);

    // Move focus into the dialog
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetchMilestoneQuests(milestone.id)
      .then((res) => {
        if (cancelled) return;
        setQuests(res.quests);
        if (
          res.milestone.time_budget_minutes_per_day &&
          res.milestone.time_budget_minutes_per_day > 0
        ) {
          setResolvedBudget(res.milestone.time_budget_minutes_per_day);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load milestone quests:', err);
        setLoadError(toFriendlyError(err, FRIENDLY_MILESTONE_QUESTS_ERROR));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(focusTimer);
      if (triggerElementRef.current && document.body.contains(triggerElementRef.current)) {
        triggerElementRef.current.focus();
      }
    };
  }, [milestone]);

  useEffect(() => {
    if (!milestone) return;
    function handleWindowKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [milestone, onClose]);

  if (!milestone) {
    return null;
  }

  async function handleAddQuest(e: React.FormEvent) {
    e.preventDefault();
    if (!milestone || submitting) return;

    setFormError(null);
    setBudgetNote(null);

    const today = todayLocalDate();
    let parsedMinutes: number | null | undefined;
    if (newMinutes.trim() !== '') {
      const asNum = Number(newMinutes.trim());
      if (!Number.isInteger(asNum) || asNum < 1 || asNum > 120) {
        setFormError('Estimated minutes should be a whole number between 1 and 120 ♡');
        return;
      }
      parsedMinutes = asNum;
    }

    const schema = createManualQuestBodySchema(today);
    const validation = schema.safeParse({
      milestone_id: milestone.id,
      title: newTitle,
      due_date: newDueDate,
      ...(parsedMinutes !== undefined ? { estimated_minutes: parsedMinutes } : {}),
      local_date: today,
    });

    if (!validation.success) {
      const firstMessage =
        validation.error.issues[0]?.message ?? 'Please check your quest details ♡';
      setFormError(firstMessage);
      return;
    }

    setSubmitting(true);
    try {
      const res = await createQuest(validation.data);
      const nextQuests = [...quests, res.quest].sort(
        (a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id,
      );
      setQuests(nextQuests);
      setNewTitle('');
      setNewMinutes('');

      const budget =
        res.time_budget_minutes_per_day && res.time_budget_minutes_per_day > 0
          ? res.time_budget_minutes_per_day
          : resolvedBudget;
      const dayMinutes =
        res.daily_minutes_on_due_date ??
        nextQuests
          .filter((q) => q.due_date === res.quest.due_date)
          .reduce((sum, q) => sum + (q.estimated_minutes ?? 0), 0);

      if (res.over_daily_budget || dayMinutes > budget) {
        setBudgetNote(
          `Gentle note: ${res.quest.due_date} now has ${dayMinutes} mins planned (your daily budget is ${budget} mins) — pace yourself softly ♡`,
        );
      }

      onQuestsChanged?.();
    } catch (err) {
      console.error('Could not add manual quest:', err);
      setFormError(toFriendlyError(err, FRIENDLY_CREATE_QUEST_ERROR));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete(quest: Quest) {
    if (deletingId !== null) return;
    setDeletingId(quest.id);
    setDeleteError(null);
    try {
      await deleteQuest(quest.id, todayLocalDate());
      setQuests((prev) => prev.filter((q) => q.id !== quest.id));
      setConfirmingDeleteId(null);
      onQuestsChanged?.();
    } catch (err) {
      console.error('Could not delete quest:', err);
      setDeleteError(toFriendlyError(err, FRIENDLY_DELETE_QUEST_ERROR));
    } finally {
      setDeletingId(null);
    }
  }

  const doneCount = quests.filter((q) => q.completed_at !== null).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 px-3 pb-4 pt-6 sm:items-center sm:pb-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={milestone.description ? descId : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
        className="flex max-h-[calc(100vh-2.5rem)] w-full max-w-[540px] flex-col overflow-hidden rounded-window border-2 border-pink/40 bg-panel shadow-window"
      >
        <header className="flex items-center justify-between gap-2 bg-gel-pink px-4 py-2.5 text-white">
          <div className="flex items-center gap-2 min-w-0">
            <span className="rounded-pill bg-white/25 px-2.5 py-0.5 text-xs font-bold">
              Stage {milestone.position}
            </span>
            <h2 id={titleId} className="m-0 truncate font-display text-base">
              {milestone.title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close stage sheet"
            className="rounded-pill bg-white/90 px-2.5 py-1 text-xs font-bold text-pink-ink hover:bg-white focus:outline-none focus:ring-2 focus:ring-white"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
            {milestone.description ? (
              <p id={descId} className="m-0 text-sm text-ink">
                {milestone.description}
              </p>
            ) : null}
            <div className="flex items-center gap-3 font-semibold">
              {milestone.target_date ? <span>🗓️ Target: {milestone.target_date}</span> : null}
              <span>
                ♡ {doneCount}/{quests.length} done
              </span>
            </div>
          </div>

          {loadError ? (
            <p role="alert" className="rounded-xl bg-pink-pale p-3 text-sm font-semibold text-pink-ink">
              {loadError}
            </p>
          ) : null}

          {deleteError ? (
            <p role="alert" className="rounded-xl bg-pink-pale p-3 text-sm font-semibold text-pink-ink">
              {deleteError}
            </p>
          ) : null}

          <section aria-label="Quests in this stage" className="space-y-2">
            <h3 className="m-0 text-xs font-bold uppercase tracking-wide text-ink-soft">
              Stage Quests
            </h3>
            {loading ? (
              <p className="text-sm text-ink-soft">Mochi is gathering your quests…</p>
            ) : quests.length === 0 ? (
              <p className="rounded-xl bg-blue-pale/70 p-3 text-sm text-ink-soft">
                No quests on this stage yet — add one of your own below ♡
              </p>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {quests.map((quest) => {
                  const isDone = quest.completed_at !== null;
                  const isConfirming = confirmingDeleteId === quest.id;
                  const isDeleting = deletingId === quest.id;

                  return (
                    <li
                      key={quest.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border border-pink/20 px-3 py-2.5 ${
                        isDone ? 'bg-pink-pale/50 opacity-80' : 'bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={`m-0 flex items-center gap-1.5 text-sm font-semibold text-ink ${
                            isDone ? 'line-through text-ink-soft' : ''
                          }`}
                        >
                          {isDone ? (
                            <span aria-hidden="true" className="text-pink-ink">
                              ✓
                            </span>
                          ) : null}
                          <span>{quest.title}</span>
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                          <span>Due {quest.due_date}</span>
                          {quest.estimated_minutes ? (
                            <span>• {quest.estimated_minutes} min</span>
                          ) : null}
                          <span>• {isDone ? 'Done' : 'Open'}</span>
                        </div>
                      </div>

                      {isConfirming ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => {
                              void handleConfirmDelete(quest);
                            }}
                            aria-label={`Confirm delete: ${quest.title}`}
                            className="rounded-pill bg-danger px-2.5 py-1 text-xs font-bold text-white hover:opacity-95 disabled:opacity-50"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setConfirmingDeleteId(null)}
                            className="rounded-pill bg-blue-pale px-2.5 py-1 text-xs font-bold text-blue-ink hover:bg-blue-pale/80"
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setConfirmingDeleteId(quest.id);
                          }}
                          aria-label={`Delete quest: ${quest.title}`}
                          className="shrink-0 rounded-pill bg-pink-pale px-2.5 py-1 text-xs font-bold text-pink-ink hover:bg-pink/20 focus:outline-none focus:ring-2 focus:ring-pink"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {budgetNote ? (
            <p
              role="status"
              className="rounded-xl border border-blue-ink/20 bg-blue-pale p-3 text-xs font-semibold text-blue-ink"
            >
              {budgetNote}
            </p>
          ) : null}

          <form onSubmit={(e) => void handleAddQuest(e)} noValidate className="space-y-3 rounded-xl bg-purple-pale/70 p-3">
            <h3 className="m-0 text-xs font-bold uppercase tracking-wide text-ink">
              ＋ Add your own quest
            </h3>

            {formError ? (
              <p role="alert" className="m-0 rounded-lg bg-pink-pale p-2 text-xs font-semibold text-pink-ink">
                {formError}
              </p>
            ) : null}

            <div className="space-y-1">
              <label htmlFor={newQuestInputId} className="block text-xs font-bold text-ink">
                New quest
              </label>
              <input
                id={newQuestInputId}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Read 2 pages before bed"
                maxLength={200}
                className="w-full rounded-lg border border-pink/30 bg-white px-3 py-1.5 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink/30"
              />
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px] space-y-1">
                <label htmlFor={dueDateInputId} className="block text-xs font-bold text-ink">
                  Due date
                </label>
                <input
                  id={dueDateInputId}
                  type="date"
                  value={newDueDate}
                  min={todayLocalDate()}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full rounded-lg border border-pink/30 bg-white px-3 py-1.5 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink/30"
                />
              </div>

              <div className="w-24 space-y-1">
                <label htmlFor={minutesInputId} className="block text-xs font-bold text-ink">
                  Minutes (opt)
                </label>
                <input
                  id={minutesInputId}
                  type="number"
                  min={1}
                  max={120}
                  value={newMinutes}
                  onChange={(e) => setNewMinutes(e.target.value)}
                  placeholder="15"
                  className="w-full rounded-lg border border-pink/30 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink/30"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-pill bg-gel-pink px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
              >
                {submitting ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
