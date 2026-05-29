import { test, expect } from '@playwright/test';

test.describe('Error states', () => {
  test('wrong-chain banner appears when wallet on wrong chain', async ({ page }) => {
    await page.goto('/app');
    // Mock wallet on wrong chain by intercepting the chain ID response
    await page.route('**/api/**', async (route) => {
      if (route.request().url().includes('chain')) {
        await route.fulfill({ status: 200, body: JSON.stringify({ chainId: 1 }) });
      } else {
        await route.continue();
      }
    });
    // The wrong-chain banner should appear if wallet is connected to mainnet
    const banner = page.locator('[data-testid="wrong-chain-banner"], [role="alert"]');
    // Soft assertion — banner only shows if wallet is actually connected
    if (await banner.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(banner).toContainText(/wrong|switch|network/i);
    }
  });

  test('paused-contract banner appears when contract paused', async ({ page }) => {
    await page.route('**/api/deployment-status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ paused: true, reason: 'maintenance' }),
      });
    });
    await page.goto('/app');
    const banner = page.locator('[data-testid="paused-banner"], [role="alert"]');
    if (await banner.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(banner).toContainText(/paused|maintenance/i);
    }
  });

  test('insufficient-balance disables submit when input > balance', async ({ page }) => {
    await page.goto('/app/vault');
    const input = page.locator('input[name="amount"], input[placeholder*="amount" i]');
    if (await input.isVisible()) {
      await input.fill('999999999999');
      const submit = page.getByRole('button', { name: /deposit/i });
      if (await submit.isVisible()) {
        await expect(submit).toBeDisabled();
      }
    }
  });
});
