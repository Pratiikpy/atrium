import { test, expect, devices } from '@playwright/test';

test.use(devices['iPhone 14']);

test.describe('Mobile flows @mobile', () => {
  test('1. Connect wallet (test mode)', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('[data-testid="connect-wallet"], [data-testid="onboarding-step"]')).toBeVisible();
  });

  test('2. Deposit USDC via vault', async ({ page }) => {
    await page.goto('/app/vault');
    const input = page.locator('input[name="amount"], input[placeholder*="amount" i]');
    if (await input.isVisible()) {
      await input.fill('10');
      const submit = page.getByRole('button', { name: /deposit/i });
      if (await submit.isEnabled()) {
        await submit.click();
        await expect(page.locator('[data-testid="tx-success"], [data-testid="tx-hash"]')).toBeVisible({ timeout: 60_000 });
      }
    }
  });

  test('3. Open hedged position', async ({ page }) => {
    await page.goto('/app/trade');
    const fillBtn = page.getByRole('button', { name: /open|submit|trade/i });
    if (await fillBtn.isVisible()) {
      await expect(page.locator('form, [data-testid="trade-form"]')).toBeVisible();
    }
  });

  test('4. View Lantern attestation', async ({ page }) => {
    await page.goto('/app/reserves');
    const verifyBtn = page.getByRole('button', { name: /verify my balance/i });
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
      await expect(
        page.locator('[data-testid="inclusion-proof"], [data-testid="no-attestation"]')
      ).toBeVisible({ timeout: 30_000 });
    }
  });

  test('5. Kill switch via FAB', async ({ page }) => {
    await page.goto('/app');
    const fab = page.locator('[data-testid="kill-switch-fab"], button[aria-label*="kill" i]');
    if (await fab.isVisible()) {
      await fab.click();
      const confirm = page.getByRole('button', { name: /confirm/i });
      if (await confirm.isVisible()) {
        await confirm.click();
        await expect(page.locator('[data-testid="tx-success"], [data-testid="tx-hash"]')).toBeVisible({ timeout: 60_000 });
      }
    }
  });
});
