import type { Quest } from '@questline/shared';
import styles from './QuestItem.module.css';

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
      className={`${styles.item} ${done ? styles.itemDone : ''}`.trim()}
      data-completed={done ? 'true' : 'false'}
    >
      <input
        id={checkboxId}
        className={styles.checkbox}
        type="checkbox"
        checked={done}
        disabled={disabled}
        aria-label={quest.title}
        onChange={(event) => onToggle(quest.id, event.target.checked)}
      />
      <label htmlFor={checkboxId} className={styles.label}>
        <span className={`${styles.title} ${done ? styles.titleDone : ''}`.trim()}>
          {quest.title}
        </span>
        {quest.estimated_minutes !== null ? (
          <span className={styles.meta}>~{quest.estimated_minutes} min</span>
        ) : null}
        {done && quest.completed_at ? (
          <span className={styles.meta}>Done at {formatCompletedAt(quest.completed_at)}</span>
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
