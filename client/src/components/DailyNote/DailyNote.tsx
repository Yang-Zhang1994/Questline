import { Link } from 'react-router';
import type { Milestone, Quest, RoadmapGoal } from '@questline/shared';
import type { TodayViewStatus } from '../../hooks/useTodayQuests';
import { MochiAvatar, type MochiMood } from '../MochiAvatar';

/** Maximum number of due-today quests shown in Mochi's short greeting note before "+N more". */
export const MAX_VISIBLE_TODAY_QUESTS = 3;

const QUEST_GREETING_TEMPLATES: Array<(count: number, stageTitle: string) => string> = [
  (count, stageTitle) =>
    `Good to see you! We have ${count} gentle ${count === 1 ? 'quest' : 'quests'} for "${stageTitle}" today — just one cozy step at a time ♡`,
  (count, stageTitle) =>
    `Welcome back, friend! Mochi picked ${count} small ${count === 1 ? 'quest' : 'quests'} for "${stageTitle}" today. No rush at all ♡`,
  (count, stageTitle) =>
    `Happy questing! Here ${count === 1 ? 'is 1 tiny step' : `are ${count} tiny steps`} for "${stageTitle}" today — you've got this ♡`,
];

const REST_DAY_TEMPLATES = [
  'No quests are due today — enjoy a cozy rest day! Your next small step will be waiting whenever you are ready ♡',
  'Today is a gentle breather day with zero quests due. Stretch, sip something warm, and rest up ♡',
  'All clear for today! Take a guilt-free rest day — Mochi is cheering for you ♡',
];

function hashSeed(seed: string): number {
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) {
    sum = (sum + seed.charCodeAt(i)) % 997;
  }
  return sum;
}

export function buildMochiTodayGreeting(options: {
  status: TodayViewStatus;
  todayDate?: string | null;
  milestoneTitle?: string | null;
  questCount: number;
}): string {
  const { status, todayDate, milestoneTitle, questCount } = options;
  const seed = hashSeed(`${todayDate ?? 'today'}:${milestoneTitle ?? ''}:${questCount}`);

  if (status === 'loading') {
    return "Mochi is opening today's quest note for you… ♡";
  }
  if (status === 'error') {
    return "Let's take a soft breath together — Mochi couldn't load today's note just yet.";
  }
  if (status === 'no_goal') {
    return "Good to see you! We don't have an active goal yet. Let's talk about something you'd like to start ♡";
  }
  if (status === 'no_milestones') {
    return 'Your goal is ready! Head to Talk and tap "Draw my map" so we can sketch your stages together ♡';
  }
  if (status === 'rest_day') {
    return REST_DAY_TEMPLATES[seed % REST_DAY_TEMPLATES.length];
  }

  const stageTitle = milestoneTitle?.trim() || 'your current stage';
  const template = QUEST_GREETING_TEMPLATES[seed % QUEST_GREETING_TEMPLATES.length];
  return template(questCount, stageTitle);
}

function moodForStatus(status: TodayViewStatus): MochiMood {
  if (status === 'loading' || status === 'error') return 'think';
  if (status === 'rest_day') return 'wink';
  return 'happy';
}

export type DailyNoteProps = {
  status: TodayViewStatus;
  goal: RoadmapGoal | null;
  milestone: Milestone | null;
  todayDate: string | null;
  todayQuests: Quest[];
  error?: string | null;
  onRetry?: () => void;
};

export function DailyNote({
  status,
  goal,
  milestone,
  todayDate,
  todayQuests,
  error = null,
  onRetry,
}: DailyNoteProps) {
  const visibleQuests = todayQuests.slice(0, MAX_VISIBLE_TODAY_QUESTS);
  const remainingCount = Math.max(0, todayQuests.length - visibleQuests.length);
  const greeting = buildMochiTodayGreeting({
    status,
    todayDate,
    milestoneTitle: milestone?.title ?? null,
    questCount: todayQuests.length,
  });

  return (
    <div className="relative z-[1] flex w-full max-w-[640px] flex-col items-center gap-4">
      <section
        className="w-full overflow-hidden rounded-window border-[3px] border-pink bg-pink-pale shadow-window animate-rise-in motion-reduce:animate-none"
        aria-label="A note from Mochi"
      >
        <header className="flex items-center justify-between gap-3 bg-gel-pink px-4 py-[0.7rem] font-display text-[1.05rem] tracking-[0.01em] text-white">
          <span className="inline-flex items-center gap-1.5">✉ A note from Mochi</span>
          <span className="inline-flex items-center gap-2 text-[0.8rem] font-body">
            {todayDate ? (
              <span
                className="rounded-pill bg-white/25 px-2.5 py-0.5 font-bold text-white"
                data-testid="today-note-date"
              >
                {todayDate}
              </span>
            ) : null}
            <span aria-hidden="true">♡ ♡</span>
          </span>
        </header>

        <div className="bg-note-lines px-5 py-5">
          {goal ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[0.82rem] text-ink-soft">
              <span className="rounded-pill bg-panel/90 px-3 py-1 font-bold text-ink shadow-sm">
                Goal: {goal.title}
              </span>
              {milestone ? (
                <span className="rounded-pill bg-blue-pale px-3 py-1 font-bold text-blue-ink">
                  Stage: {milestone.title}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="h-24 w-24 shrink-0 -rotate-2 rounded-[14px] border-2 border-pink/30 bg-panel p-2 shadow-polaroid">
              <MochiAvatar mood={moodForStatus(status)} />
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p
                className="m-0 font-display text-[1.05rem] leading-relaxed text-ink"
                data-testid="mochi-greeting"
              >
                {greeting}
              </p>

              {status === 'loading' ? (
                <p className="mt-2 mb-0 text-[0.9rem] text-ink-soft" role="status">
                  Checking your quest diary…
                </p>
              ) : null}

              {status === 'error' ? (
                <div className="mt-3 rounded-[14px] border border-pink/35 bg-panel/90 px-4 py-3">
                  <p className="m-0 text-[0.9rem] text-ink" role="alert">
                    {error ||
                      "Mochi couldn't open today's quest note right now. Take a gentle breath and try again in a moment."}
                  </p>
                  {onRetry ? (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-2.5 rounded-pill bg-gel-pink px-4 py-1.5 text-[0.85rem] font-bold text-white shadow-sm hover:opacity-95"
                    >
                      Try again ♡
                    </button>
                  ) : null}
                </div>
              ) : null}

              {status === 'rest_day' ? (
                <p
                  className="mt-2 mb-0 text-[0.92rem] text-ink-soft"
                  data-testid="rest-day-subcopy"
                >
                  Rest days count too — we&apos;ll pick right back up when your next quest is due.
                </p>
              ) : null}

              {status === 'quests_today' ? (
                <div className="mt-3">
                  <ul
                    className="m-0 flex list-none flex-col gap-2 p-0"
                    aria-label="Quests due today"
                  >
                    {visibleQuests.map((quest) => (
                      <li
                        key={quest.id}
                        data-testid="today-quest-item"
                        className="flex items-center justify-between gap-3 rounded-[14px] border border-pink/30 bg-panel/95 px-3.5 py-2.5 text-left shadow-sm"
                      >
                        <span className="min-w-0 flex-1 font-bold text-ink">
                          <span className="mr-1.5 text-pink-ink" aria-hidden="true">
                            ✦
                          </span>
                          {quest.title}
                        </span>
                        {quest.estimated_minutes != null ? (
                          <span
                            data-testid="today-quest-minutes"
                            className="shrink-0 rounded-pill bg-blue-pale px-2.5 py-0.5 text-[0.78rem] font-bold text-blue-ink"
                          >
                            ~{quest.estimated_minutes} min
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {remainingCount > 0 ? (
                    <p
                      className="mt-2.5 mb-0 text-[0.85rem] font-bold text-pink-ink"
                      data-testid="today-quests-more"
                    >
                      +{remainingCount} more {remainingCount === 1 ? 'quest' : 'quests'} due today
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {status === 'no_goal' ? (
        <Link
          to="/talk"
          className="inline-flex items-center gap-2 rounded-pill border-2 border-white bg-gel-pink px-6 py-3 font-display text-[1rem] text-white no-underline shadow-window transition-transform hover:-translate-y-0.5"
        >
          ♡ Plan a goal with Mochi
        </Link>
      ) : null}

      {status === 'no_milestones' ? (
        <Link
          to="/talk"
          className="inline-flex items-center gap-2 rounded-pill border-2 border-white bg-gel-pink px-6 py-3 font-display text-[1rem] text-white no-underline shadow-window transition-transform hover:-translate-y-0.5"
        >
          🗺️ Draw my map with Mochi
        </Link>
      ) : null}
    </div>
  );
}
