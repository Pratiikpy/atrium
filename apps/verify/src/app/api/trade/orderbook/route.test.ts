import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

/**
 * Iter 71 audit fix: locks KK-2 + iter-40 on /api/trade/orderbook.
 *
 * - KK-2: pre-fix `(parseFloat(bids[0].price) + parseFloat(asks[0].price)) / 2`
 *   shipped the literal string "NaN" to the UI when either side's
 *   price was malformed. Fix: validate both parse to finite numbers,
 *   fall back to "—" otherwise.
 * - iter-40: midDelta24h was hardcoded to '0.00' + midDeltaDirection
 *   'flat' even though nothing measured the 24h delta. The UI rendered
 *   "$X 0.00 · 24h" implying a real no-change. Fix: null in both
 *   fields, UI fallback handles null → "—".
 */

function makeRequest(query: string = ''): NextRequest {
  const url = `http://localhost/api/trade/orderbook${query ? '?' + query : ''}`;
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/trade/orderbook — KK-2 NaN guard', () => {
  it('returns mid:"—" when both bid and ask are missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ levels: [[], []] }), { status: 200 }),
    );
    const json = await (await GET(makeRequest())).json();
    expect(json.midPrice).toBe('—');
    expect(json.source).toBe('hyperliquid');
    fetchSpy.mockRestore();
  });

  it('returns mid:"—" when bid price is malformed (KK-2)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          levels: [
            [{ px: 'NaN', sz: '1.5' }],
            [{ px: '100.50', sz: '1.5' }],
          ],
        }),
        { status: 200 },
      ),
    );
    const json = await (await GET(makeRequest())).json();
    // Pre-KK-2: midPrice would have been the literal string "NaN".
    expect(json.midPrice).toBe('—');
    fetchSpy.mockRestore();
  });

  it('returns mid:"—" when ask price is malformed', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          levels: [
            [{ px: '100.50', sz: '1.5' }],
            [{ px: 'undefined', sz: '1.5' }],
          ],
        }),
        { status: 200 },
      ),
    );
    const json = await (await GET(makeRequest())).json();
    expect(json.midPrice).toBe('—');
    fetchSpy.mockRestore();
  });

  it('computes mid as (bid + ask) / 2 with 2-decimal precision', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          levels: [
            [{ px: '100.00', sz: '1.5' }],
            [{ px: '101.00', sz: '1.5' }],
          ],
        }),
        { status: 200 },
      ),
    );
    const json = await (await GET(makeRequest())).json();
    expect(json.midPrice).toBe('100.50');
    fetchSpy.mockRestore();
  });
});

describe('GET /api/trade/orderbook — iter-40 null delta honesty', () => {
  it('returns midDelta24h:null + midDeltaDirection:null in success path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ levels: [[], []] }), { status: 200 }),
    );
    const json = await (await GET(makeRequest())).json();
    // Critical: nulls, NOT '0.00' / 'flat'. The 24h delta is unmeasured.
    expect(json.midDelta24h).toBeNull();
    expect(json.midDeltaDirection).toBeNull();
    fetchSpy.mockRestore();
  });

  it('returns null deltas in pending path (no double-source-of-truth)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('hl down'));
    const json = await (await GET(makeRequest())).json();
    expect(json.midDelta24h).toBeNull();
    expect(json.midDeltaDirection).toBeNull();
    expect(json.source).toBe('pending');
    fetchSpy.mockRestore();
  });
});

describe('GET /api/trade/orderbook — orderbook formatting', () => {
  it('caps bids and asks at 12 levels each', async () => {
    const levels = Array.from({ length: 20 }, (_, i) => ({ px: String(100 + i), sz: '1' }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ levels: [levels, levels] }), { status: 200 }),
    );
    const json = await (await GET(makeRequest())).json();
    expect(json.bids).toHaveLength(12);
    expect(json.asks).toHaveLength(12);
    fetchSpy.mockRestore();
  });

  it('tags each bid/ask with side', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          levels: [
            [{ px: '99.5', sz: '1' }],
            [{ px: '100.5', sz: '1' }],
          ],
        }),
        { status: 200 },
      ),
    );
    const json = await (await GET(makeRequest())).json();
    expect(json.bids[0].side).toBe('bid');
    expect(json.asks[0].side).toBe('ask');
    fetchSpy.mockRestore();
  });

  it('strips -PERP suffix when querying upstream HL info feed', async () => {
    let capturedBody: string | undefined;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, init) => {
      capturedBody = String(init?.body);
      return new Response(JSON.stringify({ levels: [[], []] }), { status: 200 });
    });
    await GET(makeRequest('symbol=HSLA-PERP'));
    expect(capturedBody).toContain('"coin":"HSLA"');
    expect(capturedBody).not.toContain('-PERP');
    fetchSpy.mockRestore();
  });

  it('passes through the symbol in the response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ levels: [[], []] }), { status: 200 }),
    );
    const json = await (await GET(makeRequest('symbol=BTC-PERP'))).json();
    expect(json.symbol).toBe('BTC-PERP');
    fetchSpy.mockRestore();
  });
});

describe('GET /api/trade/orderbook — error paths', () => {
  it('returns pending on HL info feed 5xx', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 502 }));
    const json = await (await GET(makeRequest())).json();
    expect(json.source).toBe('pending');
    expect(json.midPrice).toBe('—');
    expect(json.bids).toEqual([]);
    expect(json.asks).toEqual([]);
    fetchSpy.mockRestore();
  });

  it('returns pending on fetch network error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ENOTFOUND'));
    const json = await (await GET(makeRequest())).json();
    expect(json.source).toBe('pending');
    fetchSpy.mockRestore();
  });

  it('returns pending on JSON parse failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not-json', { status: 200 }),
    );
    const json = await (await GET(makeRequest())).json();
    expect(json.source).toBe('pending');
    fetchSpy.mockRestore();
  });
});
