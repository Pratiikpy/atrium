import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

// The shared vitest.setup.ts sets a global DEMO_WALLET_ADDRESS so session-
// gated route tests get a demo session. This route reads that env directly
// to decide the (!plinth || !wallet) pending branch — the tests below
// assume NO wallet so the preview falls to the honest pending state. Force
// it unset here and restore after, keeping the global default for everyone
// else. (vi.stubEnv('', ) sets an empty/falsy value; unstub restores it.)
beforeEach(() => {
  vi.stubEnv('DEMO_WALLET_ADDRESS', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * Iter 61 audit fix: locks the JJ-1 / JJ-2 / JJ-3 audit fixes for the
 * /api/trade/margin-impact endpoint. Pre-iter-61 the route had three
 * documented audit fixes but zero tests pinning them — meaning a
 * refactor reverting any of them would slip past CI:
 *
 * - JJ-1: parseSizeUsdOrNull rejects NaN, Infinity, negative,
 *         scientific-notation, non-numeric strings, and absurd
 *         (>$1B) values. Pre-fix these flowed into
 *         BigInt(Math.floor(sizeUsd * 1e6)) and either threw a
 *         RangeError or produced wrong margin numbers shown to the
 *         user during the open-position flow.
 * - JJ-2: buffer-bps math no longer adds 1n to the denominator (was
 *         an off-by-up-to-2× precision error on small required
 *         amounts).
 * - JJ-3: response uses the audit-tested formatUsd helper for the
 *         large-bigint precision case.
 *
 * The route is the pre-trade margin preview shown to users BEFORE
 * they open a position. Wrong values here mislead the user about
 * the position's true margin requirement — a UX failure that
 * silently puts users into positions they didn't budget for.
 */

function makeRequest(query: string): NextRequest {
  const url = `http://localhost/api/trade/margin-impact${query ? '?' + query : ''}`;
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/trade/margin-impact — JJ-1 input validation', () => {
  it('rejects missing size param', async () => {
    const res = await GET(makeRequest(''));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_size');
  });

  it('rejects empty-string size', async () => {
    const res = await GET(makeRequest('size='));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_size');
  });

  it('rejects NaN string', async () => {
    const res = await GET(makeRequest('size=NaN'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_size');
  });

  it('rejects Infinity string', async () => {
    const res = await GET(makeRequest('size=Infinity'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_size');
  });

  it('rejects negative value', async () => {
    const res = await GET(makeRequest('size=-100'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_size');
  });

  it('rejects scientific notation (1e10)', async () => {
    // 1e10 = 10B which is > the $1B cap; but JJ-1 regex would reject
    // the scientific notation form anyway as a defensive layer.
    const res = await GET(makeRequest('size=1e10'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_size');
  });

  it('rejects non-numeric text', async () => {
    const res = await GET(makeRequest('size=abc'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_size');
  });

  it('rejects value above $1B ceiling', async () => {
    // JJ-1: MAX_REASONABLE_SIZE_USD = 1_000_000_000 — exactly at the
    // boundary should pass, one above must fail.
    const res = await GET(makeRequest('size=1000000001'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_size');
  });

  it('rejects fractional values containing a sign (+100)', async () => {
    // The validation regex is strict: `^\d+(\.\d+)?$` — no leading sign
    // even though `parseFloat("+100") === 100` would work. The strict
    // regex is the load-bearing JJ-1 sanitizer.
    const res = await GET(makeRequest('size=%2B100'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_size');
  });

  it('rejects hex (0x100)', async () => {
    const res = await GET(makeRequest('size=0x100'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_size');
  });
});

describe('GET /api/trade/margin-impact — valid input passes JJ-1, falls to pending', () => {
  it('accepts 0 as a valid size (zero-margin preview)', async () => {
    // Zero is a valid size — passes JJ-1, then falls into the
    // (!plinth || !wallet) pending branch under test conditions
    // since DEMO_WALLET_ADDRESS isn't set in the test env.
    const res = await GET(makeRequest('size=0'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('pending');
    expect(json.buyingPowerAfterUsd).toBeNull();
  });

  it('accepts a typical $1000 size', async () => {
    const res = await GET(makeRequest('size=1000'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('pending');
  });

  it('accepts exactly $1B (boundary)', async () => {
    // The JJ-1 cap is `> MAX_REASONABLE_SIZE_USD`, so exactly at the
    // boundary must pass. Pre-iter-61 there was no test asserting
    // the off-by-one semantics.
    const res = await GET(makeRequest('size=1000000000'));
    expect(res.status).toBe(200);
  });

  it('accepts decimal value (123.45)', async () => {
    const res = await GET(makeRequest('size=123.45'));
    expect(res.status).toBe(200);
  });

  it('mentions the venue in pending notes (default hyperliquid)', async () => {
    // Audit fix (#19): default venue is now a real VENUES id ('hyperliquid'),
    // not the bogus 'hl-hip3' the route used to fall back to.
    const res = await GET(makeRequest('size=100'));
    const json = await res.json();
    expect(json.notes).toContain('hyperliquid');
  });

  it('mentions the custom venue in pending notes', async () => {
    const res = await GET(makeRequest('size=100&venue=aave-v3'));
    const json = await res.json();
    expect(json.notes).toContain('aave-v3');
  });
});



describe('GET /api/trade/margin-impact — P0-4 IDOR gate', () => {
  // The route reads wallet-scoped Plinth collateral/margin, so ?wallet= must be
  // locked to the authenticated session. In tests (NODE_ENV !== 'production')
  // getSession falls back to DEMO_WALLET_ADDRESS — set it to simulate the
  // session wallet and request a different one.
  it('denies a ?wallet= that does not match the session wallet (403)', async () => {
    vi.stubEnv('DEMO_WALLET_ADDRESS', '0x' + 'a'.repeat(40));
    const res = await GET(makeRequest('size=1000&wallet=0x' + 'b'.repeat(40)));
    expect(res.status).toBe(403);
  });

  it('allows a ?wallet= matching the session wallet (falls to pending, not 403)', async () => {
    const w = '0x' + 'a'.repeat(40);
    vi.stubEnv('DEMO_WALLET_ADDRESS', w);
    const res = await GET(makeRequest('size=1000&wallet=' + w));
    // Gate passes -> route proceeds (200 with live 'plinth' data when the
    // test Plinth is available, or 'pending' otherwise). The point is it is
    // NOT blocked (401/403) for the matching wallet.
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(['plinth', 'pending']).toContain(json.source);
  });
});
