import { test, expect } from '@playwright/test';

/**
 * Journey 8, REAL agent-mandate signature through the UI (funded-key connector).
 *
 * The mandate is a single EIP-712 IntentSigil signature (no broadcast): clicking
 * "Sign mandate" routes through the funded-key connector's eth_signTypedData_v4,
 * then POSTs the signed envelope to /api/agents/issue-mandate which verifies it
 * against the deployed Sigil. A real signature → "Mandate signed. Intent hash …".
 *
 * Single-action flow (no allowance-refetch), so it drives reliably with the
 * connector. Gated on E2E_KEY_BUILD.
 */
const RUN = process.env.E2E_KEY_BUILD === '1';
const ADDR_PREFIX = (process.env.NEXT_PUBLIC_E2E_ADDRESS ?? '0x6821').slice(0, 6);

test.describe('Real mandate sign (funded-key connector)', () => {
  test.skip(!RUN, 'needs the funded-key build (E2E_KEY_BUILD=1)');

  test('connect → sign EIP-712 mandate → Mandate signed @critical', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/app/portfolio');
    await page.getByRole('button', { name: /connect wallet/i }).first().click();
    await expect(page.getByText(new RegExp(ADDR_PREFIX, 'i')).first()).toBeVisible({ timeout: 20_000 });

    await page.goto('/app/agents');
    const newMandate = page.getByRole('button', { name: /new mandate/i }).first();
    await expect(newMandate).toBeEnabled({ timeout: 20_000 });
    await newMandate.click();

    // Modal: agent address is the first text input (placeholder "0x…"); caps +
    // venue allowlist default (2 venues pre-selected).
    const agentInput = page.locator('input[type="text"]').first();
    await expect(agentInput).toBeVisible({ timeout: 10_000 });
    await agentInput.fill('0x1111111111111111111111111111111111111111');

    const sign = page.getByRole('button', { name: /sign mandate/i }).first();
    await expect(sign).toBeEnabled({ timeout: 10_000 });
    await sign.click();

    // The connector signs the EIP-712 envelope; the API verifies it against the
    // deployed Sigil and returns the intent hash.
    await expect(page.getByText(/Mandate signed/i).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Intent hash/i).first()).toBeVisible();
    console.log('REAL mandate signed via the funded-key connector');
  });
});
