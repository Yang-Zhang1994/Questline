import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { Milestone, Quest } from '@questline/shared';

export type MilestoneSheetProps = {
  milestone: Pick<
    Milestone,
    'id' | 'title' | 'description' | 'target_date' | 'status' | 'position'
  >;
  quests: Quest[];
  doneCount: number;
  totalCount: number;
  loading?: boolean;
  busy?: boolean;
  error?: string | null;
  defaultDueDate: string;
  onClose: () => void;
  onAdd: (title: string, dueDate: string) => Promise<unknown>;
  onDelete: (questId: number) => Promise<unknown>;
};

/**
 * Map node bottom sheet — list quests, add with due date, delete with ✕ (Issue #20).
 */
export function MilestoneSheet({
  milestone,
  quests,
  doneCount,
  totalCount,
  loading = false,
  busy = false,
  error = null,
  defaultDueDate,
  onClose,
  onAdd,
  onDelete,
}: MilestoneSheetProps) {
  const titleId = useId();
  const nameId = useId();
  const dueId = useId();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setFormError('Give this quest a little name ♡');
      return;
    }
    setFormError(null);
    const ok = await onAdd(trimmed, dueDate);
    if (ok !== null && ok !== false) {
      setTitle('');
      setDueDate(defaultDueDate);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/35 px-3 pb-3 pt-10 sm:items-center sm:p-6"
      role="presentation"
      onClick={onClose}
      data-testid="milestone-sheet-backdrop"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-50 max-h-[min(90vh,40rem)] w-full max-w-[640px] overflow-y-auto rounded-window border-[3px] border-pink bg-panel shadow-window animate-rise-in motion-reduce:animate-none"
        data-testid="milestone-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-[1] flex items-start justify-between gap-3 bg-gel-pink px-4 py-[0.7rem] text-white">
          <div className="min-w-0">
            <p className="m-0 font-ui text-[0.72rem] font-bold uppercase tracking-[0.04em] opacity-90">
              Stage {milestone.position}
            </p>
            <h2 id={titleId} className="m-0 font-display text-[1.1rem] leading-snug">
              {milestone.title}
            </h2>
            <p className="m-0 mt-1 text-[0.8rem] opacity-95" data-testid="milestone-sheet-progress">
              ♡ {doneCount}/{totalCount} quests done
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-pill bg-white/25 px-2.5 py-1 text-[0.9rem] font-bold text-white hover:bg-white/40"
            aria-label="Close milestone sheet"
            data-testid="milestone-sheet-close"
          >
            ✕
          </button>
        </header>

        <div className="space-y-4 px-4 py-4">
          {milestone.description ? (
            <p className="m-0 text-[0.92rem] leading-relaxed text-ink-soft">{milestone.description}</p>
          ) : null}

          {loading ? (
            <p className="m-0 text-[0.9rem] text-ink-soft" aria-busy="true">
              Mochi is fetching this stage’s quests…
            </p>
          ) : null}

          <ul className="m-0 list-none space-y-2 p-0" aria-label="Quests in this stage">
            {quests.map((quest) => {
              const done = quest.completed_at != null;
              return (
                <li
                  key={quest.id}
                  className={[
                    'flex items-start gap-2 rounded-[14px] border px-3 py-2',
                    done ? 'border-tree/40 bg-meadow/50' : 'border-pink/30 bg-white/80',
                  ].join(' ')}
                  data-testid={`milestone-sheet-quest-${quest.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        'm-0 text-[0.92rem] font-bold text-ink',
                        done ? 'line-through opacity-70' : '',
                      ].join(' ')}
                    >
                      {quest.title}
                    </p>
                    <p className="m-0 mt-0.5 text-[0.78rem] text-ink-soft">Due {quest.due_date}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void onDelete(quest.id);
                    }}
                    disabled={busy}
                    className="shrink-0 rounded-pill px-2.5 py-1 text-[0.85rem] font-bold text-danger hover:bg-pink-pale disabled:cursor-wait disabled:opacity-60"
                    aria-label={`Delete ${quest.title}`}
                    data-testid={`milestone-sheet-delete-${quest.id}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
            {!loading && quests.length === 0 ? (
              <li className="rounded-[14px] border border-dashed border-ink-soft/30 px-3 py-3 text-[0.88rem] text-ink-soft">
                No quests on this stage yet — add one below, or ask Mochi to plan.
              </li>
            ) : null}
          </ul>

          <form
            className="space-y-3 rounded-[14px] border border-pink/35 bg-pink-pale/60 px-3 py-3"
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            data-testid="milestone-sheet-add-form"
          >
            <div>
              <label
                htmlFor={nameId}
                className="mb-1 block font-ui text-[0.72rem] font-bold uppercase tracking-[0.04em] text-ink-soft"
              >
                New quest
              </label>
              <input
                id={nameId}
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (formError) setFormError(null);
                }}
                maxLength={200}
                disabled={busy}
                className="w-full rounded-[12px] border-2 border-pink/40 bg-white px-3 py-2 text-[0.92rem] text-ink outline-none focus:border-pink"
                placeholder="A tiny next step…"
                data-testid="milestone-sheet-new-quest"
                autoComplete="off"
              />
            </div>
            <div>
              <label
                htmlFor={dueId}
                className="mb-1 block font-ui text-[0.72rem] font-bold uppercase tracking-[0.04em] text-ink-soft"
              >
                Due date
              </label>
              <input
                id={dueId}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={busy}
                required
                className="w-full rounded-[12px] border-2 border-pink/40 bg-white px-3 py-2 text-[0.92rem] text-ink outline-none focus:border-pink"
                data-testid="milestone-sheet-due-date"
              />
            </div>
            {formError ? (
              <p className="m-0 text-[0.88rem] text-danger" role="alert">
                {formError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center rounded-pill bg-gel-pink px-4 py-2 text-[0.88rem] font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
              data-testid="milestone-sheet-add"
            >
              {busy ? 'Adding…' : 'Add'}
            </button>
          </form>

          {error ? (
            <p className="m-0 text-[0.9rem] text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Link
            to="/talk"
            className="inline-flex items-center justify-center rounded-pill bg-white px-4 py-2 text-[0.85rem] font-bold text-blue-ink no-underline shadow-sm hover:bg-blue-pale"
          >
            ♡ Ask Mochi to plan
          </Link>
        </div>
      </section>
    </div>
  );
}
