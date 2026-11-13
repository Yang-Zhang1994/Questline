import type { Milestone } from '@questline/shared';
import { MochiAvatar } from '../MochiAvatar';
import styles from './MilestoneNode.module.css';

export interface MilestoneNodeProps {
  milestone: Milestone;
  isCurrent?: boolean;
  onSelect?: (milestone: Milestone) => void;
}

export function MilestoneNode({
  milestone,
  isCurrent = false,
  onSelect,
}: MilestoneNodeProps) {
  const isCompleted = milestone.status === 'completed';
  const isUpcoming = milestone.status === 'upcoming';

  return (
    <div
      className={`${styles.card} ${isCurrent ? styles.current : ''} ${
        isCompleted ? styles.completed : ''
      } ${isUpcoming ? styles.upcoming : ''}`}
      aria-current={isCurrent ? 'step' : undefined}
      data-status={milestone.status}
      data-testid={`milestone-node-${milestone.id}`}
      onClick={() => onSelect?.(milestone)}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(milestone);
        }
      }}
    >
      {isCurrent && (
        <div className={styles.mochiIndicator} aria-hidden="true">
          <div className={styles.avatarWrapper}>
            <MochiAvatar mood="happy" />
          </div>
          <span className={styles.mochiBubble}>You are here!</span>
        </div>
      )}

      <div className={styles.headerRow}>
        <span className={styles.stageBadge}>
          Stage {milestone.position}
        </span>
        {!isCurrent && (
          <span
            className={`${styles.statusPill} ${
              isCompleted
                ? styles.statusPillCleared
                : styles.statusPillUpcoming
            }`}
          >
            <span aria-hidden="true">{isCompleted ? '★' : '✧'}</span>{' '}
            {isCompleted ? 'Cleared' : 'Upcoming'}
          </span>
        )}
      </div>

      <h3 className={styles.title}>{milestone.title}</h3>
      <p className={styles.description}>{milestone.description}</p>

      <div className={styles.footerRow}>
        <span className={styles.targetDate}>
          <span className={styles.dateIcon} aria-hidden="true">
            🗓️
          </span>{' '}
          Target: {milestone.target_date}
        </span>
        {milestone.total_quests !== undefined && milestone.total_quests > 0 && (
          <span className={styles.questProgress} aria-label={`${milestone.done_quests ?? 0} of ${milestone.total_quests} quests completed`}>
            ♡ {milestone.done_quests ?? 0}/{milestone.total_quests} done
          </span>
        )}
      </div>
    </div>
  );
}
