import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config, host-side unit tests for the verify app.
 *
 * Runs pure-function tests over `src/lib/*` and any component logic that
 * doesn't need a browser. Browser-required tests live in `tests/e2e/` and
 * run through Playwright (see playwright.config.ts).
 *
 * Excludes the Playwright e2e directory so `vitest run` and `playwright test`
 * stay strictly separated.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    environment: 'node',
    globals: false,
    // Stubs next/headers cookies()/headers() + sets a demo session so route
    // handlers that call getSession() run in the node unit env. See
    // vitest.setup.ts (2026-05-29 audit fix).
    setupFiles: ['./vitest.setup.ts'],
    reporters: process.env.CI ? ['default', 'github-actions'] : 'default',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
