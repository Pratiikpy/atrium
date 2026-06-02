import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';

/**
 * getSession is the read side of the HMAC session + the demo fallback. The
 * security-critical property is fail-CLOSED in production: a prod deploy that
 * still has DEMO_WALLET_ADDRESS set must NOT authenticate anonymous callers as
 * the demo wallet unless an operator explicitly opted in.
 */

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
}));

import { getSession, requireWalletMatch } from './auth-session';

const SECRET = 'test-session-secret-' + 'x'.repeat(32);
const WALLET = '0x6821e3360d686a11b73afab4e3bc258fe7cc4a76';

function token(walletAddress: string, expiresAt: number, secret = SECRET): string {
  const data = JSON.stringify({ walletAddress, expiresAt });
  const sig = createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64');
}
function req(): Request {
  return new Request('http://localhost/x');
}

beforeEach(() => {
  jar.clear();
  vi.stubEnv('ATRIUM_SESSION_SECRET', SECRET);
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DEMO_WALLET_ADDRESS', '');
  vi.stubEnv('ATRIUM_ALLOW_DEMO_SESSION', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  jar.clear();
});

describe('getSession, cookie path', () => {
  it('returns the wallet for a valid HMAC session', async () => {
    jar.set('atrium-session', token(WALLET, Date.now() + 3_600_000));
    expect(await getSession(req())).toEqual({ walletAddress: WALLET });
  });
  it('rejects a token signed with the wrong secret (forged HMAC)', async () => {
    jar.set('atrium-session', token(WALLET, Date.now() + 3_600_000, 'attacker-secret'));
    expect(await getSession(req())).toBeNull();
  });
  it('rejects an expired session', async () => {
    jar.set('atrium-session', token(WALLET, Date.now() - 1));
    expect(await getSession(req())).toBeNull();
  });
  it('rejects malformed base64/JSON without throwing', async () => {
    jar.set('atrium-session', 'not-valid-base64-token');
    expect(await getSession(req())).toBeNull();
  });
  it('returns null when ATRIUM_SESSION_SECRET is unset (cannot verify)', async () => {
    vi.stubEnv('ATRIUM_SESSION_SECRET', '');
    jar.set('atrium-session', token(WALLET, Date.now() + 3_600_000));
    expect(await getSession(req())).toBeNull();
  });
});

describe('getSession, demo fallback (fail-closed in prod)', () => {
  it('uses DEMO_WALLET_ADDRESS in non-production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DEMO_WALLET_ADDRESS', WALLET);
    expect(await getSession(req())).toEqual({ walletAddress: WALLET });
  });
  it('does NOT fabricate a session in production without explicit opt-in', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_WALLET_ADDRESS', WALLET);
    expect(await getSession(req())).toBeNull();
  });
  it('allows the demo session in production only with ATRIUM_ALLOW_DEMO_SESSION=true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_WALLET_ADDRESS', WALLET);
    vi.stubEnv('ATRIUM_ALLOW_DEMO_SESSION', 'true');
    expect(await getSession(req())).toEqual({ walletAddress: WALLET });
  });
  it('returns null in non-production when DEMO_WALLET_ADDRESS is unset', async () => {
    expect(await getSession(req())).toBeNull();
  });
  it('lowercases the demo wallet address', async () => {
    vi.stubEnv('DEMO_WALLET_ADDRESS', WALLET.toUpperCase().replace('0X', '0x'));
    expect((await getSession(req()))?.walletAddress).toBe(WALLET);
  });
});

describe('requireWalletMatch', () => {
  it('401 when there is no session', async () => {
    const res = await requireWalletMatch(req(), WALLET);
    expect(res?.status).toBe(401);
  });
  it('403 when the session wallet does not match the requested wallet', async () => {
    jar.set('atrium-session', token(WALLET, Date.now() + 3_600_000));
    const res = await requireWalletMatch(req(), '0x' + '1'.repeat(40));
    expect(res?.status).toBe(403);
  });
  it('allows (returns null) when the session wallet matches, case-insensitively', async () => {
    jar.set('atrium-session', token(WALLET, Date.now() + 3_600_000));
    const res = await requireWalletMatch(req(), WALLET.toUpperCase().replace('0X', '0x'));
    expect(res).toBeNull();
  });
});
