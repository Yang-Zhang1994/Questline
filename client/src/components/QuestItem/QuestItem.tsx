import type { Quest } from '@questline/shared';

export type QuestItemProps = {
  quest: Quest;
  onToggle: (questId: number, completed: boolean) => void;
  disabled?: boolean;
};

export function QuestItem({ quest, onToggle, disabled = false }: QuestItemProps) {
  const done = quest.completed_at !== null;
  const checkboxId = `quest-${quest.id}`;

  return (
    <li
      className={`flex items-start gap-3 rounded-[14px] border border-pink/30 px-3 py-[0.65rem] transition-[opacity,background-color] duration-150 ease-in-out ${
        done ? 'bg-pink-pale/55 opacity-55' : 'bg-white/72'
      }`}
      data-completed={done ? 'true' : 'false'}
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
        <span className={`font-bold ${done ? 'text-ink-soft line-through' : ''}`.trim()}>
          {quest.title}
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
