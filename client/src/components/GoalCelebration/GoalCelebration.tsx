import { Link } from 'react-router';
import { MochiAvatar } from '../MochiAvatar';

export type GoalCelebrationProps = {
  goalTitle: string;
  message: string;
  onDismiss?: () => void;
};

/**
 * Full goal-complete celebration after the final milestone clears (Issue #10).
 */
export function GoalCelebration({ goalTitle, message, onDismiss }: GoalCelebrationProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/35 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-celebration-title"
      data-testid="goal-celebration"
    >
      <section className="w-full max-w-[420px] overflow-hidden rounded-window border-[3px] border-pink bg-pink-pale shadow-window animate-rise-in motion-reduce:animate-none">
        <header className="bg-gel-pink px-4 py-[0.7rem] font-display text-[1.05rem] text-white">
          ★ Goal complete!
        </header>
        <div className="flex flex-col items-center gap-3 px-5 py-6 text-center">
          <div className="w-28 animate-soft-bob motion-reduce:animate-none [&>svg]:block [&>svg]:h-auto [&>svg]:w-full">
            <MochiAvatar mood="cheer" />
          </div>
          <h2 id="goal-celebration-title" className="m-0 font-display text-[1.15rem] text-ink">
            {goalTitle}
          </h2>
          <p className="m-0 font-bold leading-snug text-blue-ink">{message}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/map"
              className="inline-flex items-center justify-center rounded-pill bg-gel-pink px-4 py-2 text-[0.88rem] font-bold text-white no-underline shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-105"
              onClick={onDismiss}
            >
              🗺️ See your map
            </Link>
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex items-center justify-center rounded-pill bg-white/90 px-4 py-2 text-[0.88rem] font-bold text-blue-ink shadow-sm hover:bg-white"
              >
                Soft close
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
