import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** /api/auth/nonce issues a single-use nonce stored in an httpOnly cookie. */

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
}));

import { GET } from './route';

beforeEach(() => jar.clear());
afterEach(() => jar.clear());

describe('GET /api/auth/nonce', () => {
  it('returns a 32-hex-char nonce and stores it in the cookie', async () => {
    const j = await (await GET()).json();
    expect(j.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(jar.get('atrium-nonce')).toBe(j.nonce);
  });

  it('issues a fresh nonce on each call (single-use, no reuse)', async () => {
    const a = await (await GET()).json();
    const b = await (await GET()).json();
    expect(a.nonce).not.toBe(b.nonce);
  });
});
