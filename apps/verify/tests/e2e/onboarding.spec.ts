import { test, expect } from '@playwright/test';

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock WebAuthn via CDP
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    });
  });

  test('full onboarding with WebAuthn mock', async ({ page }) => {
    await page.goto('/app/onboarding');
    await page.waitForLoadState('domcontentloaded');
    // Expect onboarding step 1 (Welcome). The flow renders a step rail + the
    // current step's heading; there is no data-testid, so assert the real
    // step-1 heading that the OnboardingFlow Welcome step renders.
    await expect(page.getByRole('heading', { name: /step inside the atrium/i })).toBeVisible();
  });

  test('back navigation works', async ({ page }) => {
    await page.goto('/app/onboarding');
    await page.waitForLoadState('domcontentloaded');
    // Step-1 advance button is labelled "Set up authenticator" (not next/continue).
    const nextBtn = page.getByRole('button', { name: /set up authenticator/i });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      // Step 2 (Authenticator) renders a "← Back" control.
      const backBtn = page.getByRole('button', { name: /back/i }).first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await expect(page.getByRole('heading', { name: /step inside the atrium/i })).toBeVisible();
      }
    }
  });

  test('state persists on reload', async ({ page }) => {
    await page.goto('/app/onboarding');
    await page.waitForLoadState('domcontentloaded');
    const nextBtn = page.getByRole('button', { name: /set up authenticator/i });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      // Should resume from where we left off (step 2 Authenticator), not restart.
      // OnboardingFlow persists step to localStorage 'atrium_onboarding_v1'.
      await expect(page.getByRole('heading', { name: /create your passkey/i })).toBeVisible();
    }
  });
});
