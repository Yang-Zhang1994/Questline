import { afterEach, describe, expect, it } from 'vitest';
import { createClaudeClient } from '../ai/client.js';
import { signAuthToken, verifyAuthToken } from '../auth/jwt.js';
import {
  DEFAULT_DEV_JWT_SECRET,
  MIN_PRODUCTION_JWT_SECRET_LENGTH,
  assertJwtSecret,
  assertProductionEnv,
  resolveCorsOrigin,
} from './env.js';

const VALID_PROD_SECRET = 'a'.repeat(MIN_PRODUCTION_JWT_SECRET_LENGTH);

describe('production environment hardening (server/src/config/env.ts)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const originalAnthropicModel = process.env.ANTHROPIC_MODEL;
  const originalAllowEcho = process.env.ALLOW_ECHO_AI;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;

    if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;

    if (originalAnthropicModel === undefined) delete process.env.ANTHROPIC_MODEL;
    else process.env.ANTHROPIC_MODEL = originalAnthropicModel;

    if (originalAllowEcho === undefined) delete process.env.ALLOW_ECHO_AI;
    else process.env.ALLOW_ECHO_AI = originalAllowEcho;
  });

  it('allows the .env.example JWT_SECRET in non-production and rejects it in production', () => {
    expect(
      assertJwtSecret({
        NODE_ENV: 'development',
        JWT_SECRET: DEFAULT_DEV_JWT_SECRET,
      }),
    ).toBe(DEFAULT_DEV_JWT_SECRET);

    expect(() =>
      assertJwtSecret({
        NODE_ENV: 'production',
        JWT_SECRET: DEFAULT_DEV_JWT_SECRET,
      }),
    ).toThrow(/\.env\.example default/);

    expect(() =>
      assertJwtSecret({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(MIN_PRODUCTION_JWT_SECRET_LENGTH - 1),
      }),
    ).toThrow(/at least 32 characters/);

    expect(
      assertJwtSecret({
        NODE_ENV: 'production',
        JWT_SECRET: VALID_PROD_SECRET,
      }),
    ).toBe(VALID_PROD_SECRET);
  });

  it('requires ANTHROPIC_API_KEY and ANTHROPIC_MODEL in production unless ALLOW_ECHO_AI=true', () => {
    expect(() =>
      assertProductionEnv({
        NODE_ENV: 'production',
        JWT_SECRET: VALID_PROD_SECRET,
      }),
    ).toThrow(/ANTHROPIC_API_KEY/);

    expect(() =>
      assertProductionEnv({
        NODE_ENV: 'production',
        JWT_SECRET: VALID_PROD_SECRET,
        ANTHROPIC_API_KEY: 'sk-ant-test',
      }),
    ).toThrow(/ANTHROPIC_MODEL/);

    expect(() =>
      assertProductionEnv({
        NODE_ENV: 'production',
        JWT_SECRET: VALID_PROD_SECRET,
        ANTHROPIC_API_KEY: 'sk-ant-test',
        ANTHROPIC_MODEL: 'claude-3-5-haiku-latest',
      }),
    ).not.toThrow();

    expect(() =>
      assertProductionEnv({
        NODE_ENV: 'production',
        JWT_SECRET: VALID_PROD_SECRET,
        ALLOW_ECHO_AI: 'true',
      }),
    ).not.toThrow();
  });

  it('enforces JWT_SECRET and ANTHROPIC_* checks in signAuthToken / createClaudeClient in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = DEFAULT_DEV_JWT_SECRET;
    await expect(signAuthToken({ userId: 1, email: 'mochi@questline.local' })).rejects.toThrow(
      /JWT_SECRET/,
    );

    process.env.JWT_SECRET = VALID_PROD_SECRET;
    const token = await signAuthToken({ userId: 1, email: 'mochi@questline.local' });
    const claims = await verifyAuthToken(token);
    expect(claims).toEqual({ userId: 1, email: 'mochi@questline.local' });

    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ALLOW_ECHO_AI;
    expect(() => createClaudeClient()).toThrow(/ANTHROPIC_API_KEY/);

    process.env.ALLOW_ECHO_AI = 'true';
    const echoClient = createClaudeClient();
    await expect(
      echoClient.completeChat([{ role: 'user', content: 'Hello Mochi!' }]),
    ).resolves.toContain('Hello Mochi!');
  });

  it('resolves CORS origin without cross-origin reflection in production unless CORS_ORIGIN is set', () => {
    expect(resolveCorsOrigin({ NODE_ENV: 'development' })).toBe(true);
    expect(resolveCorsOrigin({ NODE_ENV: 'test' })).toBe(true);
    expect(resolveCorsOrigin({ NODE_ENV: 'production' })).toBe(false);
    expect(resolveCorsOrigin({ NODE_ENV: 'production', CORS_ORIGIN: '   ' })).toBe(false);
    expect(
      resolveCorsOrigin({
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://questline.onrender.com',
      }),
    ).toBe('https://questline.onrender.com');
    expect(
      resolveCorsOrigin({
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://a.example.com, https://b.example.com',
      }),
    ).toEqual(['https://a.example.com', 'https://b.example.com']);
  });
});
