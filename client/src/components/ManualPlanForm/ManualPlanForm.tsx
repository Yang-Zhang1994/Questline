import { useState, type FormEvent } from 'react';

export type ManualPlanFormValues = {
  title: string;
  concrete_goal: string;
  deadline: string;
  milestones: string[];
};

export type ManualPlanFormProps = {
  /** Prefill when offered after an AI error. */
  initialTitle?: string;
  busy?: boolean;
  error?: string | null;
  aiFallbackNotice?: boolean;
  onBackToChat: () => void;
  onSubmit: (values: ManualPlanFormValues) => void | Promise<void>;
};

function parseMilestoneLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function ManualPlanForm({
  initialTitle = '',
  busy = false,
  error = null,
  aiFallbackNotice = false,
  onBackToChat,
  onSubmit,
}: ManualPlanFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [concreteGoal, setConcreteGoal] = useState('');
  const [deadline, setDeadline] = useState('');
  const [milestonesText, setMilestonesText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const milestones = parseMilestoneLines(milestonesText);

    if (!trimmedTitle || milestones.length === 0) {
      setFormError(
        'Give your goal a little name and at least one milestone (one per line) ♡',
      );
      return;
    }

    setFormError(null);
    await onSubmit({
      title: trimmedTitle,
      concrete_goal: concreteGoal.trim(),
      deadline: deadline.trim(),
      milestones,
    });
  }

  const alert = formError ?? error;

  return (
    <section
      className="w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink bg-pink-pale shadow-window animate-rise-in"
      aria-label="Write the plan yourself"
      data-testid="manual-plan-form"
    >
      <header className="flex items-center justify-between gap-3 bg-gel-pink px-4 py-[0.7rem] font-display text-[1.05rem] tracking-[0.01em] text-white">
        <span className="inline-flex items-center gap-1.5">✎ Write the plan yourself</span>
        <button
          type="button"
          onClick={onBackToChat}
          disabled={busy}
          className="rounded-pill bg-white/20 px-3 py-1 text-[0.78rem] font-bold text-white hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-55"
          data-testid="manual-plan-back"
        >
          Back to chatting
        </button>
      </header>

      <form className="space-y-3 bg-panel/70 px-4 py-4" onSubmit={(e) => void handleSubmit(e)}>
        {aiFallbackNotice ? (
          <p
            className="m-0 rounded-[14px] border border-pink/25 bg-purple-pale px-3 py-2 text-[0.88rem] text-ink"
            data-testid="manual-plan-ai-fallback"
            role="status"
          >
            Mochi got a little tangled — you can type the plan by hand instead. No guilt, just a soft
            backup ♡
          </p>
        ) : (
          <p className="m-0 text-[0.88rem] text-ink-soft">
            Prefer typing? Sketch your goal and stages here. We&apos;ll save them when you say so.
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-[0.82rem] font-bold text-pink-ink">Goal name</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            placeholder="e.g. Read a Japanese novel"
            className="w-full rounded-pill border-2 border-pink/25 bg-panel px-4 py-2.5 text-[0.95rem] text-ink outline-none focus:border-pink"
            data-testid="manual-plan-goal-name"
            aria-required="true"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[0.82rem] font-bold text-pink-ink">Concrete goal</span>
          <textarea
            value={concreteGoal}
            onChange={(e) => setConcreteGoal(e.target.value)}
            disabled={busy}
            rows={2}
            placeholder="What “done” looks like — specific and kind"
            className="w-full resize-none rounded-[14px] border-2 border-pink/25 bg-panel px-4 py-2.5 text-[0.95rem] text-ink outline-none focus:border-pink"
            data-testid="manual-plan-concrete-goal"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[0.82rem] font-bold text-pink-ink">Deadline</span>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={busy}
            className="w-full rounded-pill border-2 border-pink/25 bg-panel px-4 py-2.5 text-[0.95rem] text-ink outline-none focus:border-pink"
            data-testid="manual-plan-deadline"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[0.82rem] font-bold text-pink-ink">
            Milestones <span className="font-normal text-ink-soft">(one per line)</span>
          </span>
          <textarea
            value={milestonesText}
            onChange={(e) => setMilestonesText(e.target.value)}
            disabled={busy}
            rows={5}
            placeholder={'Build a tiny daily habit\nFinish a short chapter\nRead a whole story'}
            className="w-full resize-y rounded-[14px] border-2 border-pink/25 bg-panel px-4 py-2.5 text-[0.95rem] text-ink outline-none focus:border-pink"
            data-testid="manual-plan-milestones"
            aria-required="true"
          />
        </label>

        {alert ? (
          <p className="m-0 text-[0.9rem] text-danger" role="alert" data-testid="manual-plan-error">
            {alert}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="rounded-pill bg-gel-pink px-5 py-2.5 font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
            data-testid="manual-plan-submit"
          >
            {busy ? 'Saving…' : '★ Save my map'}
          </button>
          <button
            type="button"
            onClick={onBackToChat}
            disabled={busy}
            className="rounded-pill bg-white px-4 py-2.5 text-[0.88rem] font-bold text-blue-ink shadow-sm hover:bg-blue-pale disabled:cursor-not-allowed disabled:opacity-55"
          >
            Back to chatting
          </button>
        </div>
      </form>
    </section>
  );
}
