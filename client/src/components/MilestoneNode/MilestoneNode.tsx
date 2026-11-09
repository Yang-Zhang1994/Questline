import type { MilestoneStatus } from '@questline/shared';
import { MochiAvatar } from '../MochiAvatar';

export type MilestoneNodeKind = 'start' | 'milestone' | 'goal';

export type MilestoneNodeProps = {
  kind: MilestoneNodeKind;
  title: string;
  /** YYYY-MM-DD target / deadline when known. */
  date?: string | null;
  /** Only meaningful for milestone nodes. */
  status?: MilestoneStatus;
  /** 1-based stage index for milestone nodes. */
  position?: number;
  /** Mark the live stage so the map can scroll to it. */
  isCurrent?: boolean;
};

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  completed: 'Cleared',
  current: 'You are here',
  upcoming: 'Ahead',
};

const STATUS_ICON: Record<MilestoneStatus, string> = {
  completed: '✓',
  current: '♡',
  upcoming: '○',
};

/**
 * One node on the Map path: Start house, a milestone stage, or the final Goal.
 * State is announced with text + icons (not color alone) for a11y.
 */
export function MilestoneNode({
  kind,
  title,
  date = null,
  status = 'upcoming',
  position,
  isCurrent = false,
}: MilestoneNodeProps) {
  const state = kind === 'start' ? 'start' : kind === 'goal' ? 'goal' : status;
  const label =
    kind === 'start' ? 'Start' : kind === 'goal' ? 'Goal' : STATUS_LABEL[status];
  const icon = kind === 'start' ? '🏠' : kind === 'goal' ? '★' : STATUS_ICON[status];

  const shellClass = [
    'relative w-full max-w-[22rem] rounded-[18px] border-[3px] px-3 py-2.5 text-left shadow-polaroid',
    kind === 'start'
      ? 'border-blue-ink/30 bg-blue-pale'
      : kind === 'goal'
        ? 'border-pink bg-pink-pale'
        : status === 'completed'
          ? 'border-tree bg-meadow/80'
          : status === 'current'
            ? 'border-pink bg-panel ring-2 ring-pink/40'
            : 'border-ink-soft/25 bg-road',
  ].join(' ');

  return (
    <li
      className={[
        'relative z-[1] flex w-full flex-col items-center',
        isCurrent ? 'scroll-mt-24' : '',
      ].join(' ')}
      data-testid={
        kind === 'milestone' && position != null
          ? `milestone-node-${position}`
          : `milestone-node-${kind}`
      }
      data-state={state}
      data-kind={kind}
      aria-current={isCurrent ? 'step' : undefined}
    >
      <article className={shellClass} aria-label={`${label}: ${title}`}>
        <div className="flex items-start gap-2.5">
          <span
            className={[
              'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[1.05rem] font-bold',
              kind === 'goal' || status === 'current'
                ? 'bg-gel-pink text-white'
                : status === 'completed'
                  ? 'bg-tree text-ink'
                  : 'bg-panel text-ink-soft',
            ].join(' ')}
            aria-hidden="true"
          >
            {kind === 'milestone' && status === 'current' ? (
              <span className="block h-7 w-7 [&_svg]:h-full [&_svg]:w-full">
                <MochiAvatar mood="happy" />
              </span>
            ) : (
              icon
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="m-0 font-ui text-[0.72rem] font-bold uppercase tracking-[0.04em] text-ink-soft">
              <span aria-hidden="true">{icon} </span>
              {label}
              {kind === 'milestone' && position != null ? (
                <span className="normal-case tracking-normal text-ink-soft/80">
                  {' '}
                  · Stage {position}
                </span>
              ) : null}
            </p>
            <h3 className="m-0 mt-0.5 font-display text-[0.98rem] leading-snug text-ink">{title}</h3>
            {date ? (
              <p className="m-0 mt-1 text-[0.8rem] text-ink-soft" data-testid="node-target-date">
                Target: {date}
              </p>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}
