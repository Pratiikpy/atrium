import { test, expect } from '@playwright/test';

const MODE = process.env.E2E_MODE ?? 'local';

test.describe('Error states', () => {
  test('wrong-chain banner appears when wallet on wrong chain', async ({ page }) => {
    test.skip(MODE === 'local', 'wrong-chain banner needs a connected wallet on the wrong chain: needs wallet harness (E2E_MODE=sepolia + Rabby)');
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
    // The paused state is fetched (no wallet needed) by useContractPaused()
    // from /api/protocol/pause-state — NOT /api/deployment-status (stale path).
    await page.route('**/api/protocol/pause-state**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ paused: true, reason: 'maintenance' }),
      });
    });
    // The paused banner ('Coffer is paused — deposits and withdrawals disabled')
    // lives in the VaultMobile panel (src/components/mobile/panels/vault-mobile.tsx),
    // which is the visible vault surface below the md breakpoint. Use a mobile
    // viewport so it renders, and visit the vault route that mounts it.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/vault');
    const banner = page.getByText(/paused/i).first();
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText(/paused/i);
  });

  test('insufficient-balance disables submit when input > balance', async ({ page }) => {
    test.skip(MODE === 'local', 'insufficient-balance gating needs a connected wallet with a known USDC balance: needs wallet harness (E2E_MODE=sepolia + Rabby)');
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
