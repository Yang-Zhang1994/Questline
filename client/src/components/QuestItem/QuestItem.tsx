import type { Quest } from '@questline/shared';

export type QuestItemProps = {
  quest: Quest;
  onToggle: (questId: number, completed: boolean) => void;
  disabled?: boolean;
  /** Past due and not done — Issue #14 overdue flag. */
  overdue?: boolean;
};

export function QuestItem({
  quest,
  onToggle,
  disabled = false,
  overdue = false,
}: QuestItemProps) {
  const done = quest.completed_at !== null;
  const checkboxId = `quest-${quest.id}`;
  const showOverdue = overdue && !done;

  return (
    <li
      className={`flex items-start gap-3 rounded-[14px] border px-3 py-[0.65rem] transition-[opacity,background-color] duration-150 ease-in-out ${
        done
          ? 'border-pink/30 bg-pink-pale/55 opacity-55'
          : showOverdue
            ? 'border-pink-ink/40 bg-pink-pale/80'
            : 'border-pink/30 bg-white/72'
      }`}
      data-completed={done ? 'true' : 'false'}
      data-overdue={showOverdue ? 'true' : 'false'}
    >
      <input
        id={checkboxId}
        className="mt-[0.15rem] h-5 w-5 shrink-0 cursor-pointer accent-pink-ink"
        type="checkbox"
        checked={done}
        disabled={disabled}
        aria-label={quest.title}
        onChange={(event) => onToggle(quest.id, event.target.checked)}
      />
      <label htmlFor={checkboxId} className="flex cursor-pointer flex-col gap-[0.2rem] leading-[1.35] text-ink">
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className={`font-bold ${done ? 'text-ink-soft line-through' : ''}`.trim()}>
            {quest.title}
          </span>
          {showOverdue ? (
            <span
              className="rounded-pill bg-pink-ink/15 px-2 py-0.5 font-ui text-[0.72rem] font-bold text-pink-ink"
              data-testid={`quest-overdue-tag-${quest.id}`}
            >
              soft leftover · due {quest.due_date}
            </span>
          ) : null}
        </span>
        {quest.estimated_minutes !== null ? (
          <span className="font-ui text-[0.8rem] text-ink-soft">~{quest.estimated_minutes} min</span>
        ) : null}
        {done && quest.completed_at ? (
          <span className="font-ui text-[0.8rem] text-ink-soft">
            Done at {formatCompletedAt(quest.completed_at)}
          </span>
        ) : null}
      </label>
    </li>
  );
}

function formatCompletedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
