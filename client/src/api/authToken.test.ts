import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  authHeaders,
  clearAuthToken,
  getAuthToken,
  hydrateAuthToken,
  setAuthToken,
} from './authToken';

const STORAGE_KEY = 'questline.authToken';

describe('authToken (Issue #8)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearAuthToken();
  });

  afterEach(() => {
    sessionStorage.clear();
    clearAuthToken();
  });

  it('stores Bearer token in memory and sessionStorage for reload', () => {
    setAuthToken('tok-123');
    expect(getAuthToken()).toBe('tok-123');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('tok-123');
  });

  it('hydrateAuthToken restores a token saved in sessionStorage', () => {
    sessionStorage.setItem(STORAGE_KEY, 'persisted-tok');
    clearAuthToken();
    sessionStorage.setItem(STORAGE_KEY, 'persisted-tok');
    expect(hydrateAuthToken()).toBe('persisted-tok');
    expect(getAuthToken()).toBe('persisted-tok');
  });

  it('authHeaders sets Authorization Bearer when a token is present', () => {
    setAuthToken('abc');
    const headers = authHeaders({ 'Content-Type': 'application/json' });
    expect(headers.get('Authorization')).toBe('Bearer abc');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('authHeaders omits Authorization when logged out', () => {
    const headers = authHeaders();
    expect(headers.has('Authorization')).toBe(false);
  });

  it('clearAuthToken removes memory and sessionStorage', () => {
    setAuthToken('bye');
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
