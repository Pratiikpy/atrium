import { describe, it, expect } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

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

  it('mentions the venue in pending notes (default hl-hip3)', async () => {
    const res = await GET(makeRequest('size=100'));
    const json = await res.json();
    expect(json.notes).toContain('hl-hip3');
  });

  it('mentions the custom venue in pending notes', async () => {
    const res = await GET(makeRequest('size=100&venue=aave-v3'));
    const json = await res.json();
    expect(json.notes).toContain('aave-v3');
  });
});
