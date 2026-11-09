import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';

afterEach(() => {
  cleanup();
});

describe('LoginForm (Issue #8)', () => {
  it('submits login credentials and reports success', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onLogin={onLogin} onRegister={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByText(/demo@questline.local/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), 'demo@questline.local');
    await user.type(screen.getByLabelText(/password/i), 'demo-password-123');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith('demo@questline.local', 'demo-password-123');
    });
  });

  it('can switch to register and submit', async () => {
    const user = userEvent.setup();
    const onRegister = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onLogin={vi.fn()} onRegister={onRegister} />);

    await user.click(screen.getByRole('button', { name: /create an account/i }));
    expect(screen.getByRole('heading', { name: /join questline/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secure-pass-1');
    await user.click(screen.getByRole('button', { name: /^register$/i }));

    await waitFor(() => {
      expect(onRegister).toHaveBeenCalledWith('new@example.com', 'secure-pass-1');
    });
  });

  it('shows error message when login fails', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockRejectedValue(new Error('Invalid email or password'));
    render(<LoginForm onLogin={onLogin} onRegister={vi.fn()} />);

    await user.type(screen.getByLabelText(/email/i), 'demo@questline.local');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
  });
});
