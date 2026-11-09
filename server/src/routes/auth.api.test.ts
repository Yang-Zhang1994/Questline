import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';

describe('POST /api/auth (Issue #31)', () => {
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

  function buildApp() {
    return createApp({ db });
  }

  // AC: User can register with email + password; password stored hashed
  it('registers a user and returns a JWT + public user', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'mochi@example.com', password: 'secure-pass-1' })
      .expect(201);

    expect(res.body.user).toEqual({ id: expect.any(Number), email: 'mochi@example.com' });
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(20);
    expect(res.body).not.toHaveProperty('password');
    expect(res.body.user).not.toHaveProperty('password_hash');

    const stored = await db.query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE email = $1`,
      ['mochi@example.com'],
    );
    expect(stored.rows[0].password_hash).not.toBe('secure-pass-1');
    expect(stored.rows[0].password_hash.startsWith('$2')).toBe(true);
  });

  // AC: User can log in and receive a JWT
  it('logs in an existing user and returns a JWT', async () => {
    const app = buildApp();
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@example.com', password: 'secure-pass-1' })
      .expect(201);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'secure-pass-1' })
      .expect(200);

    expect(res.body.user.email).toBe('login@example.com');
    expect(typeof res.body.token).toBe('string');
  });

  it('rejects duplicate registration with CONFLICT', async () => {
    const app = buildApp();
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'secure-pass-1' })
      .expect(201);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'Dup@example.com', password: 'secure-pass-2' })
      .expect(409);

    expect(res.body.error).toEqual({
      code: 'CONFLICT',
      message: expect.any(String),
    });
  });

  it('rejects bad login with UNAUTHORIZED', async () => {
    const app = buildApp();
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'secure-pass-1' })
      .expect(201);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'wrong-password' })
      .expect(401);

    expect(res.body.error).toEqual({
      code: 'UNAUTHORIZED',
      message: expect.any(String),
    });
  });

  it('rejects invalid register bodies with VALIDATION_ERROR', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
