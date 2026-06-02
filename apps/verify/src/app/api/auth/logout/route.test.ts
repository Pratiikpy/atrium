import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** /api/auth/logout clears the session cookie. Must be idempotent. */

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
}));

import { POST } from './route';

beforeEach(() => jar.clear());
afterEach(() => jar.clear());

describe('POST /api/auth/logout', () => {
  it('clears the session cookie and returns ok', async () => {
    jar.set('atrium-session', 'some-token');
    const r = await POST();
    expect(r.status).toBe(200);
    expect((await r.json()).ok).toBe(true);
    expect(jar.has('atrium-session')).toBe(false);
  });

  it('is idempotent when no session exists', async () => {
    const r = await POST();
    expect((await r.json()).ok).toBe(true);
    expect(jar.has('atrium-session')).toBe(false);
  });
});
