import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Iter 68 audit fix: locks JJ-5 input validation on /api/tax/summary.
 *
 * - JJ-5: prior code interpolated `jurisdiction` and `year` directly
 *   into the upstream Tablet URL. A caller passing values containing
 *   `&` (URL-encoded `%26`) could inject extra query params at Tablet
 *   or stash attacker-controlled content into upstream HTTP logs.
 *   The fix gates both inputs through closed enums + numeric range
 *   checks; URLSearchParams re-encoding is defense in depth.
 *
 * Module imports `TABLET_URL` at load time via `process.env.TABLET_URL
 * ?? null`, so each test that wants a different URL state must
 * `vi.resetModules()` and re-import.
 */

const ORIGINAL_TABLET_URL = process.env.TABLET_URL;

function makeRequest(query: string): NextRequest {
  const url = `http://localhost/api/tax/summary${query ? '?' + query : ''}`;
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.resetModules();
  delete process.env.TABLET_URL;
});

afterEach(() => {
  if (ORIGINAL_TABLET_URL == null) delete process.env.TABLET_URL;
  else process.env.TABLET_URL = ORIGINAL_TABLET_URL;
});

describe('GET /api/tax/summary, JJ-5 input validation', () => {
  it('falls back to jurisdiction=uk on invalid input', async () => {
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest('jurisdiction=evilcorp'))).json();
    // Pre-JJ-5: 'evilcorp' would flow into the Tablet URL. Post-fix:
    // not in the closed-enum, defaults to 'uk'. Tax rate confirms.
    expect(json.taxRate).toBe('10%'); // UK rate
  });

  it('accepts uk / us / de / other (U-30, Tablet enum is `de`, not `eu`)', async () => {
    const { GET } = await import('./route');
    const usJson = await (await GET(makeRequest('jurisdiction=us'))).json();
    expect(usJson.taxRate).toBe('15%');
    const deJson = await (await GET(makeRequest('jurisdiction=de'))).json();
    expect(deJson.taxRate).toBe('25%');
    const otherJson = await (await GET(makeRequest('jurisdiction=other'))).json();
    expect(otherJson.taxRate).toBe('25%');
    // Pre-U-30 the enum accepted `eu` and forwarded to Tablet which
    // returned 422. Now `eu` is rejected at the boundary and falls back
    // to the default UK rate.
    const euJson = await (await GET(makeRequest('jurisdiction=eu'))).json();
    expect(euJson.taxRate).toBe('10%');
  });

  it('rejects non-4-digit year (falls back to 2026)', async () => {
    let captured: string | undefined;
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      captured = String(input);
      return new Response(JSON.stringify({ totalProceedsUsd: '$0' }), { status: 200 });
    });
    const { GET } = await import('./route');
    await GET(makeRequest('year=abc'));
    expect(captured).toContain('year=2026');
    fetchSpy.mockRestore();
  });

  it('rejects out-of-range year (falls back to 2026)', async () => {
    let captured: string | undefined;
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      captured = String(input);
      return new Response(JSON.stringify({}), { status: 200 });
    });
    const { GET } = await import('./route');
    await GET(makeRequest('year=1999'));
    expect(captured).toContain('year=2026');
    await GET(makeRequest('year=2100'));
    expect(captured).toContain('year=2026');
    fetchSpy.mockRestore();
  });

  it('accepts valid year in 2020-2099 range', async () => {
    let captured: string | undefined;
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      captured = String(input);
      return new Response(JSON.stringify({}), { status: 200 });
    });
    const { GET } = await import('./route');
    await GET(makeRequest('year=2027'));
    expect(captured).toContain('year=2027');
    fetchSpy.mockRestore();
  });
});

describe('GET /api/tax/summary, Tablet integration', () => {
  it('returns pending when TABLET_URL unset', async () => {
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest(''))).json();
    expect(json.source).toBe('pending');
    expect(json.totalProceedsUsd).toBeNull();
    expect(json.realisedGainUsd).toBeNull();
  });

  it('maps Tablet snake_case numeric summary to the page shape', async () => {
    process.env.TABLET_URL = 'http://tablet-mock';
    // The REAL Tablet /summary shape: native-currency numbers + a currency code
    // + the rate it used. The route formats these into the stat-row strings.
    const tablet = {
      proceeds: 12345.67,
      cost_basis: 5000,
      realized_gain: 7345.67,
      taxable_gain: 4345.67,
      tax_owed: 1042.97,
      tax_rate_pct: 24,
      allowance_total: 3000,
      allowance_used: 3000,
      currency: 'GBP',
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(tablet), { status: 200 }),
    );
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest(''))).json();
    expect(json).toEqual({
      totalProceedsUsd: '£12,345.67',
      costBasisUsd: '£5,000.00',
      realisedGainUsd: '£7,345.67',
      realisedGainDirection: 'up',
      taxOwedEstUsd: '£1,042.97',
      taxRate: '24%',
      // Allowance fields now surfaced so the allowance card reads this one
      // working path (used 3000 of a 3000 allowance -> 0 remaining).
      currency: 'GBP',
      allowanceTotal: '£3,000.00',
      allowanceUsed: '£3,000.00',
      allowanceRemaining: '£0.00',
      allowancePctUsed: null,
      source: 'tablet',
    });
    fetchSpy.mockRestore();
  });

  it('falls back to pending on Tablet 5xx', async () => {
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest(''))).json();
    expect(json.source).toBe('pending');
    expect(json.totalProceedsUsd).toBeNull();
    fetchSpy.mockRestore();
  });

  it('falls back to pending on Tablet timeout / fetch throw', async () => {
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest(''))).json();
    expect(json.source).toBe('pending');
    fetchSpy.mockRestore();
  });
});
