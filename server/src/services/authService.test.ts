import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { verifyAuthToken } from '../auth/jwt.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { createAuthService } from './authService.js';
import { AppError } from './errors.js';

describe('authService (Issue #31)', () => {
  let db: Db;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await db?.end();
  });

  function service() {
    return createAuthService({ users: createUserRepository(db) });
  }

  it('registers and returns a verifiable JWT', async () => {
    const auth = service();
    const result = await auth.register('Ada@Example.com', 'password123');
    expect(result.user.email).toBe('ada@example.com');
    const claims = await verifyAuthToken(result.token);
    expect(claims.userId).toBe(result.user.id);
    expect(claims.email).toBe('ada@example.com');
  });

  it('logs in with the same credentials', async () => {
    const auth = service();
    await auth.register('bob@example.com', 'password123');
    const result = await auth.login('bob@example.com', 'password123');
    expect(result.user.email).toBe('bob@example.com');
  });

  it('throws CONFLICT on duplicate email', async () => {
    const auth = service();
    await auth.register('dup@example.com', 'password123');
    await expect(auth.register('dup@example.com', 'password123')).rejects.toMatchObject({
      code: 'CONFLICT',
    } satisfies Partial<AppError>);
  });

  it('throws UNAUTHORIZED on bad password', async () => {
    const auth = service();
    await auth.register('eve@example.com', 'password123');
    await expect(auth.login('eve@example.com', 'nope')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    } satisfies Partial<AppError>);
  });
});
