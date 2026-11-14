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

  beforeAll(async () => {
    db = await openDatabase();
    previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    fs.mkdirSync(clientDist, { recursive: true });
    fs.writeFileSync(
      path.join(clientDist, 'index.html'),
      '<!doctype html><html><head><title>Questline</title></head><body>spa</body></html>\n',
    );
    fs.writeFileSync(path.join(clientDist, 'marker.js'), 'window.__QL=1;\n');
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
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
});
