import { expect, test } from '@playwright/test';

const DEMO_EMAIL = 'demo@questline.local';
const DEMO_PASSWORD = 'demo-password-123';

test.describe('Questline demo flows (Playwright)', () => {
  test('Flow B — login, Today quests, check-off, Map + Talk navigation', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /welcome back|join questline/i })).toBeVisible();
    await page.locator('input[name="email"]').fill(DEMO_EMAIL);
    await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: /^log in$/i }).click();

    // Today (Flow B): seeded demo goal + due quests
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByText(/japanese|mochi|quest|today/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const questCheckbox = page.getByRole('checkbox').first();
    await expect(questCheckbox).toBeVisible({ timeout: 15_000 });
    const wasChecked = await questCheckbox.isChecked();
    await questCheckbox.click();
    await expect(questCheckbox).toHaveJSProperty('checked', !wasChecked);

    // Map smoke
    await page.getByRole('link', { name: /map/i }).click();
    await expect(page).toHaveURL(/\/map/);
    await expect(page.getByText(/start|goal|stage|milestone|you are here/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // Talk smoke (Flow A entry — chat shell loads; AI uses echo in E2E)
    await page.getByRole('link', { name: /talk/i }).click();
    await expect(page).toHaveURL(/\/talk/);
    await expect(page.getByText(/mochi|chat|goal|write my own plan/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('API health is up for the preview/E2E server', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    await expect(res.json()).resolves.toMatchObject({ ok: true });
  });
});
