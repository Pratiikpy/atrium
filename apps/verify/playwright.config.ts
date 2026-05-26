import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Atrium Verifier Mode app.
 *
 * Two modes:
 *   pnpm test:e2e            — runs against the local dev server (next dev). Asserts
 *                              the HONEST PENDING UI state: buttons disabled, helper
 *                              copy naming the missing contract, "pending" badges.
 *   E2E_MODE=sepolia pnpm test:e2e — runs against a deployed Sepolia env. Asserts
 *                              on real tx-hash format + Arbiscan links + post-success
 *                              UI transitions. Only flips green once Stylus contracts
 *                              are deployed (gated on human_left.md #11).
 *
 * Per docs/conventions/testing.md §"End to end on Sepolia": each test cleans up
 * state at the end and asserts on Arbiscan tx receipt (not just UI text) when
 * running in sepolia mode.
 */
const MODE = process.env.E2E_MODE ?? 'local';
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  timeout: MODE === 'sepolia' ? 90_000 : 30_000,

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Postern smart-wallet support requires a touch-target-friendly viewport.
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      // Mobile PWA path per PRD §22.8 + docs/conventions/ui.md "Mobile path".
      // Only critical journeys run on mobile to keep CI under 90s.
      grep: /@mobile/,
    },
  ],

  // Auto-start dev server in local mode. CI/sepolia modes assume a deployment
  // already running at BASE_URL.
  webServer:
    MODE === 'local'
      ? {
          command: 'pnpm dev',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        }
      : undefined,
});
