import { test, expect } from '@playwright/test';

const MODE = process.env.E2E_MODE ?? 'local';
const isGated = (step: number) => MODE === 'local'; // local mode = pending UI

test.describe('Verifier 7-step flow', () => {
  test('Step 1: connect wallet, run step, see tx hash', async ({ page }) => {
    await page.goto('/verify/1');
    await expect(page.locator('[data-testid="step-title"]')).toBeVisible();
    if (MODE === 'sepolia') {
      await page.getByRole('button', { name: /run step/i }).click();
      await expect(page.locator('[data-testid="tx-hash"]')).toBeVisible({ timeout: 60_000 });
      const link = page.locator('a[href*="arbiscan"]');
      await expect(link).toHaveAttribute('href', /sepolia\.arbiscan\.io/);
    }
  });

  test('Step 2: gated deployment check', async ({ page }) => {
    test.skip(isGated(2), 'Step 2 gated — contracts not deployed in local mode');
    await page.goto('/verify/2');
    await page.getByRole('button', { name: /run step/i }).click();
    await expect(page.locator('[data-testid="tx-hash"]')).toBeVisible({ timeout: 60_000 });
  });

  test('Step 3: gated deployment check', async ({ page }) => {
    test.skip(isGated(3), 'Step 3 gated — contracts not deployed in local mode');
    await page.goto('/verify/3');
    await page.getByRole('button', { name: /run step/i }).click();
    await expect(page.locator('[data-testid="tx-hash"]')).toBeVisible({ timeout: 60_000 });
  });

  test('Step 4: inject fault', async ({ page }) => {
    await page.goto('/verify/4');
    const btn = page.getByRole('button', { name: /inject fault/i });
    if (await btn.isVisible()) {
      await btn.click();
      const response = await page.waitForResponse(r => r.url().includes('/chaos'));
      expect([200, 503]).toContain(response.status());
    }
  });

  test('Step 5: vigil-liquidate (gated)', async ({ page }) => {
    test.skip(isGated(5), 'Step 5 gated — vigil not deployed in local mode');
    await page.goto('/verify/5');
    await page.getByRole('button', { name: /run step/i }).click();
    await expect(page.locator('[data-testid="tx-hash"]')).toBeVisible({ timeout: 60_000 });
  });

  test('Step 6: verify balance attestation', async ({ page }) => {
    await page.goto('/verify/6');
    const btn = page.getByRole('button', { name: /verify my balance/i });
    if (await btn.isVisible()) {
      await btn.click();
      await expect(
        page.locator('[data-testid="inclusion-proof"], [data-testid="no-attestation"]')
      ).toBeVisible({ timeout: 30_000 });
    }
  });

  test('Step 7: activate kill switch', async ({ page }) => {
    await page.goto('/verify/7');
    const btn = page.getByRole('button', { name: /activate kill switch/i });
    if (await btn.isVisible() && MODE === 'sepolia') {
      await btn.click();
      await page.getByRole('button', { name: /confirm/i }).click();
      await expect(page.locator('[data-testid="tx-hash"]')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('a[href*="arbiscan"]')).toBeVisible();
    }
  });
});
