import { useCallback, useState } from 'react';
import type { PublicUser } from '@questline/shared';
import { login as apiLogin, logout as apiLogout, register as apiRegister } from '../api/auth';
import { clearAuthToken, getAuthToken, hydrateAuthToken } from '../api/authToken';

const USER_STORAGE_KEY = 'questline.authUser';

function readStoredUser(): PublicUser | null {
  try {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicUser;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.id === 'number' &&
      typeof parsed.email === 'string'
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function writeStoredUser(user: PublicUser | null): void {
  try {
    if (user) sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Ignore storage failures; token alone is enough for API calls.
  }
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => hydrateAuthToken() ?? getAuthToken());
  const [user, setUser] = useState<PublicUser | null>(() => (getAuthToken() ? readStoredUser() : null));

  const persistSession = useCallback((nextUser: PublicUser, nextToken: string) => {
    setUser(nextUser);
    setToken(nextToken);
    writeStoredUser(nextUser);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiLogin(email, password);
      persistSession(result.user, result.token);
    },
    [persistSession],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const result = await apiRegister(email, password);
      persistSession(result.user, result.token);
    },
    [persistSession],
  );

  const logout = useCallback(() => {
    apiLogout();
    clearAuthToken();
    writeStoredUser(null);
    setUser(null);
    setToken(null);
  }, []);

  return {
    token,
    user,
    isAuthenticated: Boolean(token),
    login,
    register,
    logout,
  };
}
