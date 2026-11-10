import { Fragment, useEffect, useRef } from 'react';
import type { Milestone, MilestoneGoalSummary } from '@questline/shared';
import { MilestoneNode } from '../MilestoneNode/MilestoneNode';

export type RoadmapViewProps = {
  goal: MilestoneGoalSummary;
  milestones: Milestone[];
  /** Open the milestone sheet when a stage node is tapped (Issue #20). */
  onSelectMilestone?: (milestone: Milestone) => void;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function PathConnector({ walked, testId }: { walked: boolean; testId: string }) {
  return (
    <li className="flex list-none justify-center py-1" aria-hidden="true" data-testid={testId}>
      <span className={['h-7 w-2 rounded-pill', walked ? 'bg-walked' : 'bg-road'].join(' ')} />
    </li>
  );
}

/**
 * Visual Start → milestones → Goal path for the Map page (Issue #6).
 * Highlights the current stage; completed vs upcoming are distinct via text/icons.
 */
export function RoadmapView({ goal, milestones, onSelectMilestone }: RoadmapViewProps) {
  const pathRef = useRef<HTMLOListElement | null>(null);
  const ordered = [...milestones].sort((a, b) => a.position - b.position);
  const cleared = ordered.filter((m) => m.status === 'completed').length;
  const total = ordered.length;
  const goalReached = total > 0 && cleared === total;
  const currentId = ordered.find((m) => m.status === 'current')?.id ?? null;
  const currentPosition = ordered.find((m) => m.status === 'current')?.position ?? null;

  useEffect(() => {
    const root = pathRef.current;
    if (!root || currentId == null) return;
    const target = root.querySelector<HTMLElement>('[data-state="current"]');
    if (!target || typeof target.scrollIntoView !== 'function') return;
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }, [currentId]);

  return (
    <section
      className="relative w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink bg-meadow/70 shadow-window animate-rise-in"
      aria-label="Roadmap map"
      data-testid="roadmap-view"
    >
      <header className="relative z-[1] bg-gel-pink px-4 py-[0.7rem] text-white">
        <p className="m-0 font-display text-[1.05rem] tracking-[0.01em]">🗺️ Your map</p>
        <h2 className="m-0 mt-1 text-[1rem] font-bold leading-snug" data-testid="roadmap-goal-title">
          {goal.title}
        </h2>
        <p className="m-0 mt-1 font-ui text-[0.8rem] opacity-95">
          {goal.deadline ? (
            <span data-testid="roadmap-goal-deadline">Deadline {goal.deadline}</span>
          ) : (
            <span>No deadline yet</span>
          )}
          <span className="mx-1.5" aria-hidden="true">
            ·
          </span>
          <span data-testid="roadmap-cleared-count">
            {cleared}/{total} stages cleared
          </span>
        </p>
      </header>

      <div className="relative px-3 py-5 sm:px-5">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 320 640"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="roadmap-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8F4FF" stopOpacity="0.9" />
              <stop offset="55%" stopColor="#CBF0B6" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#8CD96A" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <rect width="320" height="640" fill="url(#roadmap-sky)" />
          <ellipse cx="48" cy="120" rx="28" ry="18" fill="#8CD96A" opacity="0.55" />
          <ellipse cx="280" cy="260" rx="34" ry="22" fill="#8CD96A" opacity="0.45" />
          <ellipse cx="60" cy="480" rx="40" ry="24" fill="#8CD96A" opacity="0.4" />
          <path
            d="M160 24 C 210 90, 110 150, 160 220 C 210 290, 110 360, 160 430 C 205 490, 130 550, 160 620"
            fill="none"
            stroke="#FFF8E6"
            strokeWidth="28"
            strokeLinecap="round"
          />
          <path
            d="M160 24 C 210 90, 110 150, 160 220 C 210 290, 110 360, 160 430"
            fill="none"
            stroke="#FFD0E6"
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.95"
          />
        </svg>

        <ol
          ref={pathRef}
          className="relative z-[1] m-0 flex list-none flex-col items-center p-0"
          data-testid="roadmap-path"
        >
          <MilestoneNode kind="start" title="Begin your journey" />

          {ordered.map((milestone, index) => {
            const walked =
              milestone.status === 'completed' ||
              (currentPosition != null && milestone.position <= currentPosition);
            return (
              <Fragment key={milestone.id}>
                <PathConnector walked={walked} testId={`roadmap-connector-${index}`} />
                <MilestoneNode
                  kind="milestone"
                  title={milestone.title}
                  date={milestone.target_date}
                  status={milestone.status}
                  position={milestone.position}
                  isCurrent={milestone.status === 'current'}
                  onSelect={
                    onSelectMilestone ? () => onSelectMilestone(milestone) : undefined
                  }
                />
              </Fragment>
            );
          })}

          <PathConnector walked={goalReached} testId="roadmap-connector-goal" />
          <MilestoneNode
            kind="goal"
            title={goal.title}
            date={goal.deadline}
            isCurrent={goalReached}
            status={goalReached ? 'completed' : 'upcoming'}
          />
        </ol>
      </div>
    </section>
  );
}
