import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';

const clientDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../client/dist',
);

describe('production static hosting (Render SPA)', () => {
  let db: Db;
  let previousNodeEnv: string | undefined;
  let previousJwtSecret: string | undefined;
  let previousAllowEchoAi: string | undefined;
  let previousCorsOrigin: string | undefined;

  beforeAll(async () => {
    db = await openDatabase();
    previousNodeEnv = process.env.NODE_ENV;
    previousJwtSecret = process.env.JWT_SECRET;
    previousAllowEchoAi = process.env.ALLOW_ECHO_AI;
    previousCorsOrigin = process.env.CORS_ORIGIN;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'prod-static-test-jwt-secret-at-least-32-chars';
    process.env.ALLOW_ECHO_AI = 'true';
    delete process.env.CORS_ORIGIN;
    fs.mkdirSync(clientDist, { recursive: true });
    fs.writeFileSync(
      path.join(clientDist, 'index.html'),
      '<!doctype html><html><head><title>Questline</title></head><body>spa</body></html>\n',
    );
    fs.writeFileSync(path.join(clientDist, 'marker.js'), 'window.__QL=1;\n');
  });

  beforeEach(async () => {
    await resetDatabase(db);
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'prod-static-test-jwt-secret-at-least-32-chars';
    process.env.ALLOW_ECHO_AI = 'true';
    delete process.env.CORS_ORIGIN;
  });

  afterAll(async () => {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }
    if (previousAllowEchoAi === undefined) {
      delete process.env.ALLOW_ECHO_AI;
    } else {
      process.env.ALLOW_ECHO_AI = previousAllowEchoAi;
    }
    if (previousCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = previousCorsOrigin;
    }
    fs.rmSync(clientDist, { recursive: true, force: true });
    await db?.end();
  });

  it('keeps /api/health JSON and serves the Vite index for non-API routes', async () => {
    const app = createApp({ db });

    const health = await request(app).get('/api/health').expect(200);
    expect(health.body).toEqual({ ok: true });

    const asset = await request(app).get('/marker.js').expect(200);
    expect(asset.text).toContain('window.__QL');

    const spa = await request(app).get('/today').expect(200);
    expect(spa.text).toContain('<title>Questline</title>');

    // Unmatched API paths must not fall through to the SPA shell.
    const missingApi = await request(app).get('/api/does-not-exist');
    expect(missingApi.status).not.toBe(200);
    expect(String(missingApi.text)).not.toContain('<title>Questline</title>');
  });

  it('does not reflect arbitrary cross-origin headers in production unless CORS_ORIGIN is set', async () => {
    const defaultProdApp = createApp({ db });
    const unconfiguredRes = await request(defaultProdApp)
      .get('/api/health')
      .set('Origin', 'https://evil.example.com')
      .expect(200);
    expect(unconfiguredRes.headers['access-control-allow-origin']).toBeUndefined();

    process.env.CORS_ORIGIN = 'https://questline.onrender.com, https://staging.questline.local';
    const configuredProdApp = createApp({ db });

    const allowedRes = await request(configuredProdApp)
      .get('/api/health')
      .set('Origin', 'https://questline.onrender.com')
      .expect(200);
    expect(allowedRes.headers['access-control-allow-origin']).toBe(
      'https://questline.onrender.com',
    );

    const blockedRes = await request(configuredProdApp)
      .get('/api/health')
      .set('Origin', 'https://evil.example.com')
      .expect(200);
    expect(blockedRes.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('fails fast at startup in production when JWT_SECRET or Anthropic config is invalid', () => {
    process.env.JWT_SECRET = 'change-me-in-local-dev';
    expect(() => createApp({ db })).toThrow(/JWT_SECRET/);

    process.env.JWT_SECRET = 'too-short-for-production-31char';
    expect(() => createApp({ db })).toThrow(/JWT_SECRET/);

    process.env.JWT_SECRET = 'prod-static-test-jwt-secret-at-least-32-chars';
    delete process.env.ALLOW_ECHO_AI;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    expect(() => createApp({ db })).toThrow(/ANTHROPIC_API_KEY/);

    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    expect(() => createApp({ db })).toThrow(/ANTHROPIC_MODEL/);

    process.env.ANTHROPIC_MODEL = 'claude-test-model';
    expect(() => createApp({ db })).not.toThrow();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  });
});
