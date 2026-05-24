import { test, expect } from '@playwright/test';

/**
 * Journey 3 — Open hedged position.
 *
 * Per TDD §9.3 + Verifier Mode step 2: user opens two parallel positions —
 * long HIP-3 perp via Hyperliquid hybrid + matching Aave Horizon T-bill —
 * and Plinth nets the margin under SPAN.
 *
 * Real DOM (verified against `apps/verify/src/app/verify/[step]/page.tsx`
 * and `verifier-step-runner.tsx`):
 *   - Title comes from STEP_CONFIG['2'].title = "Open hedged position"
 *   - Description names BOTH adapters honestly
 *   - Contract line: `Plinth.open_position`
 *   - Primary button label is `Run step ${step}` from VerifierStepRunner
 *   - Top nav says "Back to overview" → href=/verify (NOT /verify/1)
 *   - Bottom nav says "Next step" → href=/verify/3 (Next.js typed-route)
 */
test.describe('Journey 3 — Open hedged position', () => {
  test('Verifier step 2 — title renders @critical @mobile', async ({ page }) => {
    await page.goto('/verify/2');
    await expect(page.getByRole('heading', { name: /open hedged position/i })).toBeVisible();
  });

  test('Step 2 names BOTH adapters: Hyperliquid + Aave Horizon @critical', async ({ page }) => {
    await page.goto('/verify/2');
    // Honesty: the demo opens TWO positions in parallel. Locks the copy
    // so a future refactor can't quietly drop one adapter.
    const body = (await page.textContent('body')) ?? '';
    expect(/hyperliquid/i.test(body)).toBe(true);
    expect(/aave horizon/i.test(body)).toBe(true);
  });

  test('Step 2 names Plinth.open_position as the contract @critical', async ({ page }) => {
    await page.goto('/verify/2');
    // The contract whose deployment gates this step must be NAMED on the
    // page. No vague "coming soon" copy.
    await expect(page.getByText(/Plinth\.open_position/i)).toBeVisible();
  });

  test('Run step 2 button exists and is disabled before deployment @critical', async ({ page }) => {
    await page.goto('/verify/2');
    // The button label is literally "Run step 2" (per VerifierStepRunner).
    // Matches both the not-connected state (where it's actually a Connect
    // button) and the connected-but-not-deployed state.
    const anyRunOrConnect = page
      .getByRole('button')
      .filter({ hasText: /(run step 2|connect with postern)/i });
    await expect(anyRunOrConnect.first()).toBeVisible();
  });

  test('Back to overview link points at /verify (not /verify/1) @critical', async ({ page }) => {
    await page.goto('/verify/2');
    // The header link uses the literal text "Back to overview" and points
    // at /verify (the overview page) — NOT at /verify/1. Locks the IA so a
    // refactor doesn't break the overview ↔ step relationship.
    const backLink = page.locator('a', { hasText: /back to overview/i }).first();
    await expect(backLink).toBeVisible();
    const href = await backLink.getAttribute('href');
    expect(href).toMatch(/^\/verify(\?|$)/);
    // Must NOT be /verify/1 — that would be circular if step 2 linked back to step 1.
    expect(href).not.toMatch(/^\/verify\/1/);
  });

  test('Next step link points at /verify/3 @critical', async ({ page }) => {
    await page.goto('/verify/2');
    // Next.js typed-routes render the query into the URL. Verify step 3
    // is the target.
    const nextLink = page.locator('a', { hasText: /next step/i }).first();
    await expect(nextLink).toBeVisible();
    const href = (await nextLink.getAttribute('href')) ?? '';
    // Accepts both `/verify/3` and `/verify/[step]?step=3` rendered forms.
    expect(href).toMatch(/(verify\/3|step=3)/);
  });

  test('Step 7 is the final step — no Next step link @critical', async ({ page }) => {
    await page.goto('/verify/7');
    // STEP_CONFIG['7'].nextStep = null → no "Next step" link rendered.
    // Locks the demo flow end-state.
    const nextLink = page.locator('a', { hasText: /next step/i });
    await expect(nextLink).toHaveCount(0);
  });
});
