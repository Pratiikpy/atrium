import { defineConfig } from 'vitest/config';

/**
 * Vitest config — Codex service unit tests.
 *
 * Iter 73 audit fix: services/codex had zero tests pre-iter-73.
 * Multiple HIGH-severity audit fixes live in src/middleware/x402.ts
 * (FIRE78-CODEX1, FFF-2, iter-42, BBBB-5) that need CI coverage so
 * a refactor can't silently break the payment-verification chain.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**'],
    environment: 'node',
    globals: false,
  },
});
