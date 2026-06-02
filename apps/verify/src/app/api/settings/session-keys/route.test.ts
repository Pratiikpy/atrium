import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';

/**
 * /api/settings/session-keys lists a wallet's session keys. The security
 * property (backend-api #59) is the IDOR gate: a connected wallet must NOT be
 * able to read ANOTHER wallet's session-key list. Tested with the REAL
 * requireWalletMatch against a real HMAC session cookie.
 */

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
}));

const tryGetSessionKeys = vi.hoisted(() => vi.fn());
vi.mock('@/lib/postern-source', () => ({ tryGetSessionKeys }));

import { GET } from './route';

const SECRET = 'test-session-secret-' + 'x'.repeat(32);
const WALLET_A = '0x6821e3360d686a11b73afab4e3bc258fe7cc4a76';
const WALLET_B = '0x' + '1'.repeat(40);
const ORIG_DEMO = process.env.DEMO_WALLET_ADDRESS;

function token(walletAddress: string, secret = SECRET): string {
  const data = JSON.stringify({ walletAddress, expiresAt: Date.now() + 3_600_000 });
  const sig = createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64');
}
function reqFor(wallet?: string): NextRequest {
  const url = wallet
    ? `http://localhost/api/settings/session-keys?wallet=${wallet}`
    : 'http://localhost/api/settings/session-keys';
  return new NextRequest(url);
}

beforeEach(() => {
  jar.clear();
  tryGetSessionKeys.mockReset();
  tryGetSessionKeys.mockResolvedValue({ keys: [], source: 'pending' });
  vi.stubEnv('ATRIUM_SESSION_SECRET', SECRET);
  vi.stubEnv('NODE_ENV', 'test');
  // Model the real prod-unset case (undefined -> route resolves wallet to null),
  // not DEMO_WALLET_ADDRESS='' which the route would pass through as an empty
  // string. delete, because stubEnv('', '') cannot produce undefined.
  delete process.env.DEMO_WALLET_ADDRESS;
});
afterEach(() => {
  vi.unstubAllEnvs();
  if (ORIG_DEMO === undefined) delete process.env.DEMO_WALLET_ADDRESS;
  else process.env.DEMO_WALLET_ADDRESS = ORIG_DEMO;
  jar.clear();
});

describe('GET /api/settings/session-keys, IDOR gate', () => {
  it('401 when querying a wallet with no session', async () => {
    const r = await GET(reqFor(WALLET_A));
    expect(r.status).toBe(401);
  });

  it('403 when the session wallet reads ANOTHER wallet (IDOR blocked)', async () => {
    jar.set('atrium-session', token(WALLET_A));
    const r = await GET(reqFor(WALLET_B));
    expect(r.status).toBe(403);
    // the protected source is never consulted on a denied read
    expect(tryGetSessionKeys).not.toHaveBeenCalled();
  });

  it('200 + count when the session wallet reads its OWN keys', async () => {
    jar.set('atrium-session', token(WALLET_A));
    tryGetSessionKeys.mockResolvedValue({ keys: [{ id: '0xabc', expiresAt: 1 }], source: 'postern' });
    const r = await GET(reqFor(WALLET_A));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.count).toBe(1);
    expect(j.source).toBe('postern');
    expect(tryGetSessionKeys).toHaveBeenCalledWith(WALLET_A);
  });

  it('200 honest empty when no wallet is given and no demo fallback (no auth required)', async () => {
    const r = await GET(reqFor());
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.count).toBe(0);
    expect(j.source).toBe('pending');
    expect(tryGetSessionKeys).toHaveBeenCalledWith(null);
  });
});
