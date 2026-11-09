import { useEffect, useState } from 'react';
import { MochiAvatar } from '../MochiAvatar';

export type LevelUpToastProps = {
  message: string | null;
  /** Auto-dismiss after this many ms (default 3200). Ignored when reduced motion prefers shorter. */
  durationMs?: number;
  onDismiss?: () => void;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Short Mochi celebration when the user levels up (Issue #11).
 * Honors prefers-reduced-motion (no bob / shorter stay).
 */
export function LevelUpToast({ message, durationMs = 3200, onDismiss }: LevelUpToastProps) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const ms = prefersReducedMotion() ? Math.min(durationMs, 1600) : durationMs;
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, ms);
    return () => window.clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message || !visible) return null;

  return (
    <div
      className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 animate-rise-in motion-reduce:animate-none"
      role="status"
      aria-live="polite"
      data-testid="level-up-toast"
    >
      <div className="flex items-center gap-3 rounded-window border-[3px] border-pink bg-pink-pale px-3 py-3 shadow-window">
        <div className="w-14 shrink-0 animate-soft-bob motion-reduce:animate-none [&>svg]:block [&>svg]:h-auto [&>svg]:w-full">
          <MochiAvatar mood="wink" />
        </div>
        <p className="m-0 font-bold leading-snug text-blue-ink">{message}</p>
      </div>
    </div>
  );
}
