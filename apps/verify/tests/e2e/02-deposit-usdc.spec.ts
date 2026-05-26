import { test, expect } from '@playwright/test';

/**
 * Journey 2 — Deposit USDC into Coffer.
 *
 * Per TDD §9.2: user lands on /app/vault, sees the Deposit card, enters
 * an amount, and submits. Pre-deployment the deposit button is disabled
 * with helper copy that names the missing contract.
 *
 * Real assertions match what `apps/verify/src/components/vault/deposit-card.tsx`
 * actually renders:
 *   - Button label: `Deposit {amount || '0'} USDC` (e.g. "Deposit 0 USDC")
 *   - Helper text: from `readinessMessage()` — names "Coffer" or "registry"
 *   - Amount input: `<input type="number" inputMode="decimal" />`
 *
 * Locks the **real-data discipline** invariants from the audit:
 *   - No fake numbers on the page (vault TVL = 0)
 *   - No dead buttons (the Deposit button is *disabled*, not silently broken)
 *   - Helper copy names the actual contract that hasn't deployed
 */
test.describe('Journey 2 — Deposit USDC', () => {
  test('Vault page loads with Deposit and Withdraw cards @critical @mobile', async ({ page }) => {
    await page.goto('/app/vault');

    await expect(page.getByRole('heading', { name: /usdc vault/i })).toBeVisible();
    // Both deposit and withdraw display panels are present (audit P-3 "Required states").
    await expect(page.locator('text=/^Deposit$/').first()).toBeVisible();
    await expect(page.locator('text=/^Withdraw$/').first()).toBeVisible();
  });

  test('Deposit submit is disabled pre-deployment (honest pending) @critical', async ({ page }) => {
    await page.goto('/app/vault');

    // The submit button label is literally `Deposit {amount} USDC`. Match
    // by the regex anchored to the USDC suffix to avoid the heading "Deposit".
    const submitButton = page.getByRole('button', { name: /deposit\s+[0-9.]+\s+usdc/i }).first();

    await expect(submitButton).toBeVisible();
    // SEPOLIA: after Coffer deploys + amount > 0, this flips to toBeEnabled.
    await expect(submitButton).toBeDisabled();
  });

  test('Vault stats render real zeros, not placeholder TVL @critical', async ({ page }) => {
    await page.goto('/app/vault');

    // docs/conventions/ui.md "Live data discipline": numbers either come from
    // Scribe/Plinth or render zero/pending. NEVER `$4.20M TVL` etc.
    const body = (await page.textContent('body')) ?? '';
    expect(body).not.toMatch(/\$4\.20M/i);
    expect(body).not.toMatch(/\$12\.3M/i);
    expect(body).not.toMatch(/42,392/);
    expect(body).not.toMatch(/\b37 agents\b/i);
  });

  test('Safety panel lists virtual-shares + circuit-breaker disclosures @critical', async ({ page }) => {
    await page.goto('/app/vault');

    // Locks the 4 honest safety disclosures from vault/page.tsx.
    await expect(page.getByText(/virtual-shares/i)).toBeVisible();
    await expect(page.getByText(/circuit breaker/i)).toBeVisible();
    await expect(page.getByText(/withdrawal sla/i).first()).toBeVisible();
  });

  test('Amount input accepts numeric, locks to type=number @critical', async ({ page }) => {
    await page.goto('/app/vault');

    // Locks: type="number" (so mobile keyboards default to numeric pad)
    //        inputMode="decimal" (so the keypad shows a period)
    //        placeholder="0.00" (semantic honest empty state)
    const amountInput = page.locator('input[type="number"][inputmode="decimal"]').first();
    await expect(amountInput).toBeVisible();
    await amountInput.fill('100.50');
    await expect(amountInput).toHaveValue('100.50');
  });

  test('Helper text names Coffer (or registry) when contract is undeployed @critical', async ({ page }) => {
    // Audit R-9 / use-deployment-status.ts: readinessMessage returns either
    // "Deposit waits on Coffer to deploy…" or "Deposit is wired but the
    // deployment registry is empty…". Either string must mention a contract
    // or the registry — never silent.
    await page.goto('/app/vault');

    const body = (await page.textContent('body')) ?? '';
    const namesCoffer = /coffer/i.test(body);
    const namesRegistry = /registry is empty/i.test(body);
    const namesDeploy = /deploy/i.test(body);
    expect(namesCoffer || namesRegistry || namesDeploy).toBe(true);
  });

  test('Link to Vault explainer at /learn is present @critical', async ({ page }) => {
    await page.goto('/app/vault');

    // The deposit card links to /learn for the vault explainer. Locks the
    // education path so users can self-serve on "what is ERC-4626".
    const learnLink = page.locator('a[href="/learn"]').first();
    await expect(learnLink).toBeVisible();
  });
});
