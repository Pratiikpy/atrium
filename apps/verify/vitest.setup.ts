import { vi } from 'vitest';

/**
 * Global vitest setup (runs once per test file, in that file's module scope,
 * so the mocks below apply to every test).
 *
 * 2026-05-29 audit fix: route handlers under test call `getSession(req)`
 * (lib/auth-session), which `await cookies()` from `next/headers`. Outside a
 * Next request scope `cookies()` throws, so any test importing such a route
 * turned the vitest job red. We:
 *   1. Stub `next/headers` so `cookies()`/`headers()` resolve to empty stores.
 *   2. Set DEMO_WALLET_ADDRESS so getSession() falls back to a demo session
 *      (the empty cookie store has no atrium-session token). This lets unit
 *      tests exercise the happy-path / state-machine logic of authed routes.
 *
 * Tests that specifically assert the 401 path can override per-test with
 * `vi.mock`/`vi.stubEnv`.
 */
process.env.DEMO_WALLET_ADDRESS ??= '0x1111111111111111111111111111111111111111';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers(),
}));
