/**
 * Bearer token for API calls (Issues #31 / #8).
 * Kept in memory and mirrored to sessionStorage so a tab reload keeps the demo session.
 * Not an httpOnly cookie — see README Auth section.
 */

const STORAGE_KEY = 'questline.authToken';

function readStorage(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore quota / private-mode failures; memory token still works for the session.
  }
}

let authToken: string | null = readStorage();

export function setAuthToken(token: string | null): void {
  authToken = token;
  writeStorage(token);
}

export function getAuthToken(): string | null {
  return authToken;
}

/** Re-read sessionStorage (used after tests wipe storage, or explicit boot). */
export function hydrateAuthToken(): string | null {
  authToken = readStorage();
  return authToken;
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

export function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}
