import { useState, type FormEvent } from 'react';

export type LoginFormProps = {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
};

type Mode = 'login' | 'register';

export function LoginForm({ onLogin, onRegister }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await onLogin(email.trim(), password);
      } else {
        await onRegister(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="w-full max-w-[420px] overflow-hidden rounded-window border-[3px] border-pink bg-pink-pale shadow-window animate-rise-in"
      aria-label="Sign in to Questline"
    >
      <header className="flex items-center justify-between gap-3 bg-gel-pink px-4 py-[0.7rem] font-display text-[1.05rem] tracking-[0.01em] text-white">
        <span>✦ {mode === 'login' ? 'Welcome back' : 'Join Questline'}</span>
        <span className="text-[0.85rem] opacity-90" aria-hidden="true">
          ♡
        </span>
      </header>

      <div className="bg-note-lines px-[1.15rem] py-5">
        <h2 className="m-0 mb-2 font-display text-[1.35rem] text-blue-ink">
          {mode === 'login' ? 'Welcome back' : 'Join Questline'}
        </h2>
        <p className="mb-4 text-[0.92rem] leading-relaxed text-ink-soft">
          {mode === 'login'
            ? "Log in to see Mochi's note and today's quests."
            : 'Create an account to start your cozy quest diary.'}
        </p>
        <p className="mb-4 rounded-lg bg-blue-pale px-3 py-2 text-[0.85rem] text-blue-ink">
          Demo: <strong>demo@questline.local</strong> / <strong>demo-password-123</strong>
        </p>

        <form className="flex flex-col gap-3" onSubmit={(e) => void handleSubmit(e)}>
          <label className="flex flex-col gap-1 text-[0.9rem] font-bold text-ink">
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border-2 border-pink/40 bg-panel px-3 py-2 font-normal text-ink outline-none focus-visible:border-pink focus-visible:ring-2 focus-visible:ring-pink/40"
              placeholder="demo@questline.local"
            />
          </label>

          <label className="flex flex-col gap-1 text-[0.9rem] font-bold text-ink">
            Password
            <input
              type="password"
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border-2 border-pink/40 bg-panel px-3 py-2 font-normal text-ink outline-none focus-visible:border-pink focus-visible:ring-2 focus-visible:ring-pink/40"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p className="m-0 text-[0.9rem] text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-pill bg-gel-pink px-4 py-2.5 font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? 'One moment…' : mode === 'login' ? 'Log in' : 'Register'}
          </button>
        </form>

        <p className="mt-4 mb-0 text-center text-[0.9rem] text-ink-soft">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button
                type="button"
                className="font-bold text-pink-ink underline-offset-2 hover:underline"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="font-bold text-pink-ink underline-offset-2 hover:underline"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
