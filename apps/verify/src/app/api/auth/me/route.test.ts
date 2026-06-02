import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';

/** /api/auth/me reflects the session for SessionSync. Read-only, never throws. */

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
}));

import { GET } from './route';

const SECRET = 'test-session-secret-' + 'x'.repeat(32);
const WALLET = '0x6821e3360d686a11b73afab4e3bc258fe7cc4a76';

function token(walletAddress: string, expiresAt: number, secret = SECRET): string {
  const data = JSON.stringify({ walletAddress, expiresAt });
  const sig = createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64');
}
function req(): Request {
  return new Request('http://localhost/api/auth/me');
}

beforeEach(() => {
  jar.clear();
  vi.stubEnv('ATRIUM_SESSION_SECRET', SECRET);
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DEMO_WALLET_ADDRESS', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  jar.clear();
});

describe('GET /api/auth/me', () => {
  it('returns the wallet bound to a valid session cookie', async () => {
    jar.set('atrium-session', token(WALLET, Date.now() + 3_600_000));
    const j = await (await GET(req() as never)).json();
    expect(j.walletAddress).toBe(WALLET);
  });

  it('returns null walletAddress when there is no session and no demo fallback', async () => {
    const j = await (await GET(req() as never)).json();
    expect(j.walletAddress).toBeNull();
  });

  it('returns null for a token signed with the wrong secret', async () => {
    jar.set('atrium-session', token(WALLET, Date.now() + 3_600_000, 'attacker-secret'));
    const j = await (await GET(req() as never)).json();
    expect(j.walletAddress).toBeNull();
  });

  it('returns null for an expired session', async () => {
    jar.set('atrium-session', token(WALLET, Date.now() - 1000));
    const j = await (await GET(req() as never)).json();
    expect(j.walletAddress).toBeNull();
  });
});
