import type { Quest } from '@questline/shared';

type Props = {
  quest: Quest;
  busy: boolean;
  onToggle: (quest: Quest) => void;
};

export function QuestItem({ quest, busy, onToggle }: Props) {
  const label = quest.completed ? `Undo: ${quest.title}` : `Complete: ${quest.title}`;

  return (
    <li className={`quest-item${quest.completed ? ' is-done' : ''}`}>
      <label className="quest-label">
        <input
          type="checkbox"
          checked={quest.completed}
          disabled={busy}
          aria-label={label}
          onChange={() => onToggle(quest)}
        />
        <span className="quest-title">{quest.title}</span>
      </label>
      {quest.completed && quest.completedAt ? (
        <time className="quest-time" dateTime={quest.completedAt}>
          Done {new Date(quest.completedAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </time>
      ) : null}
    </li>
  );
}
