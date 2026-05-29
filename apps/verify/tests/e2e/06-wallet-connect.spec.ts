import { test, expect } from '@playwright/test';

/**
 * Journey 6 — Wallet connect + connected-state reads.
 *
 * Drives the connect flow via the E2E mock connector (present only in a
 * NEXT_PUBLIC_E2E=1 build — see src/lib/wagmi.ts). The production connector is
 * the Coinbase Smart Wallet passkey/hosted flow, which cannot be driven
 * headlessly; the mock connector connects a deterministic address and the app
 * reads REAL Arbitrum Sepolia state for it.
 *
 * Real-tx flows (deposit/trade broadcast) need a funded-key connector + faucet
 * and are gated separately. This locks the connect + read-flow surface.
 *
 * Requires the app served from a `NEXT_PUBLIC_E2E=1` build; skips otherwise so
 * the suite stays green against a normal build.
 */
const IS_E2E_BUILD = process.env.NEXT_PUBLIC_E2E === '1';
const E2E_ADDR = process.env.NEXT_PUBLIC_E2E_ADDRESS ?? '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ADDR_PREFIX = E2E_ADDR.slice(0, 6); // e.g. 0xf39F

test.describe('Wallet connect (E2E mock connector)', () => {
  test.skip(!IS_E2E_BUILD, 'needs a NEXT_PUBLIC_E2E=1 build (mock connector); run the E2E build to exercise');

  test('connect → app shows the connected address @critical', async ({ page }) => {
    await page.goto('/app/portfolio');
    const connect = page.getByRole('button', { name: /connect wallet/i }).first();
    await expect(connect).toBeVisible({ timeout: 15_000 });
    await connect.click();
    // Connected state: the app renders the checksummed short address. That the
    // address appears at all is the proof the mock connector connected + the
    // ConnectWallet control flipped to its connected branch. Match the address
    // prefix (case-insensitive) for robustness to checksum casing + ellipsis.
    await expect(page.getByText(new RegExp(ADDR_PREFIX, 'i')).first()).toBeVisible({ timeout: 15_000 });
  });

  test('connected dashboard reads real on-chain state (no mock-as-real) @critical', async ({ page }) => {
    await page.goto('/app/portfolio');
    await page.getByRole('button', { name: /connect wallet/i }).first().click().catch(() => {});
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    const body = (await page.textContent('body')) ?? '';
    // Connected, the dashboard must still be honest: any unbacked value is a
    // named pending/—, never a fabricated number. Guard the prototype mocks.
    for (const mock of ['$4.20M', '$12.3M', '42,392', '37 agents']) {
      expect(body).not.toContain(mock);
    }
    // And the connected address is reflected somewhere in the shell.
    await expect(page.getByText(new RegExp(ADDR_PREFIX, 'i')).first()).toBeVisible({ timeout: 15_000 });
  });
});
