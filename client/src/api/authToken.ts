/**
 * In-memory Bearer token for API calls (Issue #31).
 * Login UI will call setAuthToken after /api/auth/login; no cookie storage yet.
 */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  return headers;
}
