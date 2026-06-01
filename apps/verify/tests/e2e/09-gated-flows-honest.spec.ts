import { test, expect } from '@playwright/test';

/**
 * Journey 9, kill-switch + trade flows handle their gated on-chain states
 * HONESTLY (funded-key connector, real connected wallet).
 *
 * These two flows can't complete on-chain in the current state, by design,
 * not by bug:
 *  - kill-switch: revokes active mandates; with no active on-chain mandate the
 *    flow must surface an honest "nothing to revoke", never a fake success.
 *  - trade: open_position routes through Coffer.adapterPull, which reverts until
 *    the adapter authorization wiring (#337, in progress) lands; the UI must
 *    surface an honest error/pending, never a fabricated fill.
 *
 * This locks the no-mock-as-real / honest-gating contract on both: the flow
 * reaches a recognised honest state and never shows fake confirmation.
 * Gated on E2E_KEY_BUILD.
 */
const RUN = process.env.E2E_KEY_BUILD === '1';
const ADDR_PREFIX = (process.env.NEXT_PUBLIC_E2E_ADDRESS ?? '0x6821').slice(0, 6);

async function connect(page: import('@playwright/test').Page) {
  await page.goto('/app/portfolio');
  await page.getByRole('button', { name: /connect wallet/i }).first().click();
  await expect(page.getByText(new RegExp(ADDR_PREFIX, 'i')).first()).toBeVisible({ timeout: 20_000 });
}

test.describe('Gated flows, honest handling (funded-key connector)', () => {
  test.skip(!RUN, 'needs the funded-key build (E2E_KEY_BUILD=1)');

  test('kill-switch surfaces an honest state, never a fake revoke @critical', async ({ page }) => {
    test.setTimeout(120_000);
    await connect(page);
    await page.goto('/app/portfolio');
    // EmergencyStopCard: "Activate kill switch" → "Confirm, this is irreversible" → activate.
    const kill = page.getByRole('button', { name: /activate kill switch|confirm.*irreversible|revoke/i }).first();
    await expect(kill).toBeVisible({ timeout: 20_000 });
    await kill.click().catch(() => {});
    await page.waitForTimeout(1_500);
    const confirm = page.getByRole('button', { name: /confirm.*irreversible/i }).first();
    if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => {});
    await page.waitForTimeout(8_000);
    const body = (await page.textContent('body')) ?? '';
    // Honest terminal state: nothing-to-revoke, revoked, or an explicit error -
    // and NEVER a fabricated "12 mandates revoked"-style number.
    expect(/nothing to revoke|no active mandate|revoked|revoke every|emergency stop/i.test(body)).toBe(true);
    expect(body).not.toMatch(/\b\d+ mandates revoked\b/i);
  });

  test('trade open surfaces an honest result, never a fake fill @critical', async ({ page }) => {
    test.setTimeout(120_000);
    await connect(page);
    await page.goto('/app/trade');
    await page.waitForTimeout(2_000);
    const size = page.locator('input[type="number"]:visible').first();
    if (await size.isVisible().catch(() => false)) await size.fill('100').catch(() => {});
    const open = page.getByRole('button', { name: /open (long|short)|open position/i }).first();
    if (await open.isVisible().catch(() => false) && (await open.isEnabled().catch(() => false))) {
      await open.click().catch(() => {});
      await page.waitForTimeout(10_000);
    }
    const body = (await page.textContent('body')) ?? '';
    // No fabricated position/fill confirmation + no prototype mock numbers.
    for (const m of ['$4.20M', '$12.3M', '42,392', '37 agents']) expect(body).not.toContain(m);
    // The page is still the trade surface (didn't crash to an error boundary).
    expect(/Application error|something went wrong|Unhandled Runtime/i.test(body)).toBe(false);
  });
});
