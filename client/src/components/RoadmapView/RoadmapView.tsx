import type { Milestone, RoadmapGoal } from '@questline/shared';
import { MilestoneNode } from '../MilestoneNode/MilestoneNode';
import { MochiAvatar } from '../MochiAvatar';
import styles from './RoadmapView.module.css';

export interface RoadmapViewProps {
  goal?: RoadmapGoal | null;
  milestones?: Milestone[];
  loading?: boolean;
  error?: string | null;
  onSelectMilestone?: (milestone: Milestone) => void;
  onPlanGoal?: () => void;
}

export function RoadmapView({
  goal = null,
  milestones = [],
  loading = false,
  error = null,
  onSelectMilestone,
  onPlanGoal,
}: RoadmapViewProps) {
  if (loading && !goal) {
    return (
      <section className={styles.emptyWindow} aria-label="Loading roadmap">
        <header className={styles.emptyTitleBar}>
          <span className={styles.titleBarText}>✉ A note from Mochi</span>
          <span className={styles.hearts} aria-hidden="true">
            ♡ ♡
          </span>
        </header>
        <div className={styles.emptyBody}>
          <div className={styles.polaroid}>
            <MochiAvatar mood="happy" />
          </div>
          <div className={styles.emptyContent}>
            <p className={styles.emptyMessage}>
              Mochi is unrolling your roadmap…
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.emptyWindow} aria-label="Roadmap error">
        <header className={styles.emptyTitleBar}>
          <span className={styles.titleBarText}>✉ A note from Mochi</span>
          <span className={styles.hearts} aria-hidden="true">
            ♡ ♡
          </span>
        </header>
        <div className={styles.emptyBody}>
          <div className={styles.polaroid}>
            <MochiAvatar mood="happy" />
          </div>
          <div className={styles.emptyContent}>
            <p className={styles.errorMessage} role="alert">
              {error}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!goal || milestones.length === 0) {
    return (
      <section className={styles.emptyWindow} aria-label="Blank roadmap">
        <header className={styles.emptyTitleBar}>
          <span className={styles.titleBarText}>✉ A note from Mochi</span>
          <span className={styles.hearts} aria-hidden="true">
            ♡ ♡
          </span>
        </header>
        <div className={styles.emptyBody}>
          <div className={styles.polaroid}>
            <MochiAvatar mood="wink" />
          </div>
          <div className={styles.emptyContent}>
            <p className={styles.emptyMessage}>
              Your map is still blank! Tell me what you'd like to achieve and I'll
              draw the road from here to there.
            </p>
            {onPlanGoal && (
              <button
                type="button"
                className={styles.planButton}
                onClick={onPlanGoal}
              >
                ♡ Plan a goal with Mochi
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  const sortedMilestones = [...milestones].sort(
    (a, b) => a.position - b.position
  );
  const clearedCount = sortedMilestones.filter(
    (m) => m.status === 'completed'
  ).length;
  const totalCount = sortedMilestones.length;
  const currentIndex = sortedMilestones.findIndex((m) => m.status === 'current');

  return (
    <section className={styles.container} aria-label="Roadmap from Start to final goal">
      {/* HUD Header */}
      <div className={styles.hudHeader}>
        <div className={styles.hudTop}>
          <span className={styles.hudTag}>🗺️ Your Journey</span>
          <span className={styles.stageCounter} aria-label={`${clearedCount} of ${totalCount} stages cleared`}>
            ★ {clearedCount}/{totalCount} stages cleared
          </span>
        </div>
        <h2 className={styles.goalTitle}>{goal.title}</h2>
        <div className={styles.goalMeta}>
          <span className={styles.deadline}>
            <span aria-hidden="true">🏁</span> Target Deadline: {goal.deadline}
          </span>
        </div>
        <div
          className={styles.progressBarBg}
          role="progressbar"
          aria-valuenow={clearedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label="Milestone completion progress"
        >
          <div
            className={styles.progressBarFill}
            style={{ width: `${(clearedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Visual Roadmap Path */}
      <div className={styles.mapCanvas}>
        <ol className={styles.roadmapList}>
          {/* Start Point */}
          <li className={styles.trackStep}>
            <div className={styles.stepMarker}>
              <div
                className={`${styles.markerDot} ${styles.markerStart}`}
                aria-label="Journey start"
              >
                🏡
              </div>
              <span className={styles.markerLabel}>Start</span>
            </div>
            <div className={styles.startCard}>
              <h3 className={styles.startTitle}>Where your journey begins</h3>
              <p className={styles.startText}>
                Every great adventure starts with a small, brave first step.
              </p>
            </div>
          </li>

          {/* Milestone Stages */}
          {sortedMilestones.map((milestone, idx) => {
            const isCurrent = milestone.status === 'current';
            const isCompleted = milestone.status === 'completed';
            const isGoal = idx === sortedMilestones.length - 1;
            const isWalked =
              isCompleted ||
              (currentIndex !== -1 && idx <= currentIndex);

            return (
              <li
                key={milestone.id}
                className={styles.trackStep}
              >
                {/* Connecting road segment */}
                <div
                  className={`${styles.roadSegment} ${
                    isWalked ? styles.roadSegmentWalked : styles.roadSegmentUpcoming
                  }`}
                  aria-hidden="true"
                />

                <div className={styles.stepMarker}>
                  <div
                    className={`${styles.markerDot} ${
                      isCompleted
                        ? styles.markerCleared
                        : isCurrent
                          ? styles.markerCurrent
                          : styles.markerUpcoming
                    }`}
                  >
                    {isCompleted ? '✓' : isGoal ? '★' : milestone.position}
                  </div>
                  <span className={styles.markerLabel}>
                    {isGoal ? 'Goal' : `Stage ${milestone.position}`}
                  </span>
                </div>

                <div className={styles.stepContent}>
                  <MilestoneNode
                    milestone={milestone}
                    isCurrent={isCurrent}
                    isGoalNode={isGoal}
                    onSelect={onSelectMilestone}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
