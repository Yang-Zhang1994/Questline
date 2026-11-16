import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3001);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

/**
 * Playwright E2E against the production Express + Vite SPA build.
 * CI starts Postgres + builds + boots `npm start` via `webServer`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm start`,
    url: `${baseURL}/api/health`,
    // Default fresh boot so a leftover API-only `npm run dev` is not reused (Cannot GET /).
    reuseExistingServer: process.env.E2E_REUSE === '1',
    timeout: 180_000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      SEED_DEMO_DATA: 'true',
      ALLOW_ECHO_AI: 'true',
      JWT_SECRET:
        process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
          ? process.env.JWT_SECRET
          : 'ci-e2e-jwt-secret-at-least-32-chars!!',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgres://questline:questline@localhost:5432/questline_e2e',
    },
  },
});
