import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLoadContractAddress = vi.fn();
vi.mock('@/lib/deployments-registry', () => ({
  loadContractAddress: (...args: unknown[]) => mockLoadContractAddress(...args),
}));

import { GET } from './route';

/**
 * The address endpoint feeds every wagmi write path (vault deposit /
 * withdraw, agents issue-mandate, etc.). Locks:
 *   1. Closed slug enum, caller can't probe arbitrary registry keys
 *   2. null passthrough when contract isn't deployed
 *   3. Real address forwarded verbatim
 */

function makeReq(slug?: string) {
  const url = new URL('http://localhost/api/deployments/address');
  if (slug !== undefined) url.searchParams.set('slug', slug);
  return new Request(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/deployments/address, input gating', () => {
  it('rejects missing slug with 400', async () => {
    const res = await GET(makeReq(undefined));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_slug');
  });

  it('rejects unknown slugs with 400 (closed enum)', async () => {
    const res = await GET(makeReq('totally-not-a-contract'));
    expect(res.status).toBe(400);
  });

  it('rejects path-traversal attempts', async () => {
    // Closed-enum check kills any "../etc/passwd" / "coffer; cat" style
    // injection at the slug boundary.
    const res = await GET(makeReq('../coffer'));
    expect(res.status).toBe(400);
    const res2 = await GET(makeReq('coffer; cat'));
    expect(res2.status).toBe(400);
  });

  it('accepts every documented slug', async () => {
    mockLoadContractAddress.mockResolvedValue(null);
    for (const slug of [
      'coffer',
      'plinth',
      'sigil',
      'vigil',
      'aqueduct',
      'praetor-timelock',
      'portico-registry',
      'rostrum',
      'lantern-attestor',
      // 114-PM3 regression: the trade open/close hooks resolve the
      // router via slug=atrium-router. A missing allowlist entry 400'd
      // both money paths before the wallet was reached.
      'atrium-router',
      // Audit U-18: Postern slugs added for Kill Switch wiring.
      'postern-kill-switch',
      'postern-key-registry',
      // Audit U-20 + U-28: per-adapter Portico slugs. Slugs are
      // adapterSlug values (some venues share, HIP-3 + HIP-4 → hyperliquid).
      'adapter-hyperliquid',
      'adapter-aave-horizon',
      'adapter-pendle',
      'adapter-curve',
      'adapter-trade-xyz',
      'adapter-polymarket',
    ]) {
      const res = await GET(makeReq(slug));
      expect(res.status).toBe(200);
    }
  });

  it('every VENUES adapterSlug has a matching adapter-* slug', async () => {
    // Audit U-28: closes a regression class. Pre-fix this iterated
    // VENUES.id which broke for HIP-4 (id `hl-hip4`, no `adapter-hl-hip4`
    // contract, HIP-4 routes through `adapter-hyperliquid`). Now we
    // iterate the de-duped adapterSlug values, matching the real contract
    // deploy pattern.
    const { VENUES } = await import('@/lib/venues');
    mockLoadContractAddress.mockResolvedValue(null);
    const uniqueSlugs = Array.from(new Set(VENUES.map((v) => v.adapterSlug)));
    for (const slug of uniqueSlugs) {
      const res = await GET(makeReq(`adapter-${slug}`));
      expect(res.status).toBe(200);
    }
  });

  it('accepts atrium-router and forwards its address (114-PM3 trade open/close regression)', async () => {
    // The Trade "Open position" + "Close" hooks resolve the router via
    // slug=atrium-router. Pre-fix this slug was absent from ALLOWED_SLUGS,
    // so the route 400'd and both trade money paths threw `address_400`
    // before touching the wallet. The router is deployed, so the route
    // must accept the slug and forward the real address.
    const router = '0xf1341270dd64Aa6c0b76b06a0F0F0f0f0F0f2717';
    mockLoadContractAddress.mockResolvedValueOnce(router);
    const res = await GET(makeReq('atrium-router'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ slug: 'atrium-router', address: router });
  });
});

describe('GET /api/deployments/address, address passthrough', () => {
  it('returns null when contract is not deployed', async () => {
    mockLoadContractAddress.mockResolvedValueOnce(null);
    const res = await GET(makeReq('coffer'));
    const body = await res.json();
    expect(body).toEqual({ slug: 'coffer', address: null });
  });

  it('forwards the real address when deployed', async () => {
    const real = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';
    mockLoadContractAddress.mockResolvedValueOnce(real);
    const res = await GET(makeReq('coffer'));
    const body = await res.json();
    expect(body).toEqual({ slug: 'coffer', address: real });
  });

  it('passes the slug straight through to the registry helper', async () => {
    mockLoadContractAddress.mockResolvedValueOnce(null);
    await GET(makeReq('plinth'));
    expect(mockLoadContractAddress).toHaveBeenCalledWith('plinth');
  });
});
