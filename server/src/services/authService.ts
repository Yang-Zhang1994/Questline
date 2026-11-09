import type { AuthResponse, PublicUser } from '@questline/shared';
import { signAuthToken } from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import type { UserRepository } from '../repositories/userRepository.js';
import { conflict, unauthorized } from './errors.js';

export type AuthServiceDeps = {
  users: UserRepository;
};

function toPublicUser(user: { id: number; email: string }): PublicUser {
  return { id: user.id, email: user.email };
}

export function createAuthService(deps: AuthServiceDeps) {
  return {
    async register(email: string, password: string): Promise<AuthResponse> {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await deps.users.findByEmail(normalizedEmail);
      if (existing) {
        throw conflict('An account with that email already exists');
      }

      const passwordHash = await hashPassword(password);
      const user = await deps.users.create(normalizedEmail, passwordHash);
      const token = await signAuthToken({ userId: user.id, email: user.email });
      return { user: toPublicUser(user), token };
    },

    async login(email: string, password: string): Promise<AuthResponse> {
      const normalizedEmail = email.trim().toLowerCase();
      const user = await deps.users.findByEmail(normalizedEmail);
      if (!user) {
        throw unauthorized('Invalid email or password');
      }

      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) {
        throw unauthorized('Invalid email or password');
      }

      const token = await signAuthToken({ userId: user.id, email: user.email });
      return { user: toPublicUser(user), token };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
