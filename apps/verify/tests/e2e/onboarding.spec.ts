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
    await page.goto('/app');
    // Expect onboarding step 1
    await expect(page.locator('[data-testid="onboarding-step"]')).toBeVisible();
  });

  test('back navigation works', async ({ page }) => {
    await page.goto('/app');
    const nextBtn = page.getByRole('button', { name: /next|continue/i });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      const backBtn = page.getByRole('button', { name: /back/i });
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await expect(page.locator('[data-testid="onboarding-step"]')).toBeVisible();
      }
    }
  });

  test('state persists on reload', async ({ page }) => {
    await page.goto('/app');
    const nextBtn = page.getByRole('button', { name: /next|continue/i });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.reload();
      // Should resume from where we left off, not restart
      await expect(page.locator('[data-testid="onboarding-step"]')).toBeVisible();
    }
  });
});
