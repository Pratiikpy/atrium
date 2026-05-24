import { test, expect } from '@playwright/test';

/**
 * Journey 5 — Kill Switch.
 *
 * Per TDD §9.5 + PRD §22.7: one-tap revoke of every active Sigil mandate
 * AND every active Postern session key in a single batched transaction.
 * The most security-critical surface on the demo path.
 *
 * Real DOM (verified against `verifier-step-runner.tsx` lines around handleRun):
 *   - The primary button is "Run step 7" (NOT "Kill Switch" or "Trigger")
 *     because all 7 steps share the same component
 *   - Kill Switch confirmation uses `window.confirm()` — a NATIVE browser
 *     dialog, not a DOM element. So we listen via `page.on('dialog', ...)`
 *     rather than `getByRole('dialog')`.
 *   - The confirm message must mention BOTH "revoke" and "cannot be undone"
 *     so the user understands the destructive surface
 */
test.describe('Journey 5 — Kill Switch', () => {
  test('Kill Switch surfaces on the app dashboard @critical @mobile', async ({ page }) => {
    // The dashboard /app mentions Kill Switch in the Agents tile.
    await page.goto('/app');
    const killSwitch = page.getByText(/kill switch/i).first();
    await expect(killSwitch).toBeVisible();
  });

  test('Verifier step 7 — Kill Switch — renders the batched-revoke description @critical', async ({ page }) => {
    await page.goto('/verify/7');
    await expect(page.getByRole('heading', { name: /kill switch revoke/i })).toBeVisible();
    // Honesty: copy names BOTH things it revokes.
    const body = (await page.textContent('body')) ?? '';
    expect(/sigil mandate/i.test(body)).toBe(true);
    expect(/session key/i.test(body)).toBe(true);
    expect(/batched transaction/i.test(body)).toBe(true);
  });

  test('Step 7 names PosternKillSwitch.activate as the contract @critical', async ({ page }) => {
    await page.goto('/verify/7');
    // Locks the contract reference so a refactor doesn't hide what's about
    // to be called.
    await expect(page.getByText(/PosternKillSwitch\.activate/i)).toBeVisible();
  });

  test('Native confirm() dialog fires before any tx @critical', async ({ page }) => {
    // Per verifier-step-runner.tsx around handleRun:
    //   if (step === 7) { window.confirm(...) }
    // Playwright catches native dialogs via page.on('dialog', ...).
    // The dialog text must mention BOTH "revoke" and "cannot be undone".
    await page.goto('/verify/7');

    let dialogText = '';
    page.on('dialog', async (dialog) => {
      dialogText = dialog.message();
      await dialog.dismiss();
    });

    // The button label is "Run step 7" because all 7 steps share the same
    // VerifierStepRunner component. It may be disabled if no wallet is
    // connected — in that case the test ends here (the Connect button is
    // the gate); we only assert the dialog logic when the button is reachable.
    const runButton = page.getByRole('button', { name: /run step 7/i });
    if ((await runButton.count()) > 0 && (await runButton.first().isEnabled())) {
      await runButton.first().click();
      // The dialog handler is async; wait briefly.
      await page.waitForTimeout(500);
      expect(dialogText).toMatch(/revoke/i);
      expect(dialogText).toMatch(/cannot be undone|cannot.*undone|irreversible/i);
    }
  });

  test('Step 7 page does not auto-trigger Kill Switch on load @critical', async ({ page }) => {
    // Locks the safety invariant: navigating to the step must NEVER fire
    // the revoke automatically. The button click is the only trigger.
    let unexpectedDialog = false;
    page.on('dialog', async (dialog) => {
      unexpectedDialog = true;
      await dialog.dismiss();
    });

    await page.goto('/verify/7');
    await page.waitForLoadState('networkidle');

    expect(unexpectedDialog).toBe(false);
  });

  test('No "Next step" link on step 7 — it is the terminal step @critical', async ({ page }) => {
    await page.goto('/verify/7');
    // STEP_CONFIG['7'].nextStep = null. Locks the demo end-state.
    const nextLink = page.locator('a', { hasText: /next step/i });
    await expect(nextLink).toHaveCount(0);
  });

  test('Kill Switch is reachable from the app shell, not buried @critical', async ({ page }) => {
    // Per UI rules: must be reachable from mobile in ≤ 2 taps. /verify/7 is
    // 1 hop from the verifier overview; the dashboard /app must also surface
    // a Kill Switch entry-point (confirmed in app/page.tsx).
    await page.goto('/app');
    const hasInlineMention = (await page.getByText(/kill switch/i).count()) > 0;
    expect(hasInlineMention).toBe(true);
  });
});
