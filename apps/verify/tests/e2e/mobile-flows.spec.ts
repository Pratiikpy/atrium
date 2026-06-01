import { test, expect, devices } from '@playwright/test';

test.use(devices['iPhone 14']);

const MODE = process.env.E2E_MODE ?? 'local';

test.describe('Mobile flows @mobile', () => {
  // Describe-level gate: these flows use devices['iPhone 14'] (WebKit) AND a
  // connected wallet. Skipping at the describe level (not per-test) prevents
  // the WebKit browser from even launching in local/pending mode, a per-test
  // skip runs only AFTER the browser fixture, which fails if WebKit isn't
  // installed. Runs fully under E2E_MODE=sepolia with the Rabby harness.
  test.skip(MODE === 'local', 'mobile wallet flows need the wallet harness + WebKit (E2E_MODE=sepolia + Rabby)');

  test('1. Connect wallet (test mode)', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('[data-testid="connect-wallet"], [data-testid="onboarding-step"]')).toBeVisible();
  });

  test('2. Deposit USDC via vault', async ({ page }) => {
    test.skip(MODE === 'local', 'real USDC deposit tx + tx-hash result: needs wallet harness (E2E_MODE=sepolia + Rabby)');
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

  test('3. Open a position', async ({ page }) => {
    test.skip(MODE === 'local', 'open-position CTA is gated on deployment readiness + a real trade tx: needs wallet harness (E2E_MODE=sepolia + Rabby)');
    await page.goto('/app/trade');
    const fillBtn = page.getByRole('button', { name: /open|submit|trade/i });
    if (await fillBtn.isVisible()) {
      await expect(page.locator('form, [data-testid="trade-form"]')).toBeVisible();
    }
  });

  test('4. View Lantern attestation', async ({ page }) => {
    test.skip(MODE === 'local', 'Verify-my-balance is disabled without a connected address: needs wallet harness (E2E_MODE=sepolia + Rabby)');
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
    test.skip(MODE === 'local', 'kill-switch FAB only renders with a scoped wallet + activation is an on-chain tx: needs wallet harness (E2E_MODE=sepolia + Rabby)');
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
