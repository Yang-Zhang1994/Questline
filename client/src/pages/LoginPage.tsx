import { LoginForm } from '../components/LoginForm/LoginForm';

export type LoginPageProps = {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
};

export function LoginPage({ onLogin, onRegister }: LoginPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="pointer-events-none fixed inset-0 bg-sparkles opacity-70 animate-twinkle" aria-hidden="true" />
      <header className="mb-6 animate-soft-bob text-center motion-reduce:animate-none">
        <h1 className="m-0 bg-brand-title bg-clip-text-fill font-display text-[clamp(2rem,5vw,2.8rem)]">
          Questline
        </h1>
        <p className="mt-1 text-[0.95rem] text-ink-soft">your little quest diary with Mochi ♡</p>
      </header>
      <LoginForm onLogin={onLogin} onRegister={onRegister} />
    </div>
  );
}
