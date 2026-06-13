import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Iter 68 audit fix: locks NN-1 input validation on /api/tax/events.
 *
 * - NN-1: third occurrence of the JJ-5/LL-1 query-param injection
 *   pattern. Closed-enum jurisdiction + numeric-range year. Same
 *   contract as tax/summary and tax/export.
 */

const ORIGINAL_TABLET_URL = process.env.TABLET_URL;

function makeRequest(query: string): NextRequest {
  const url = `http://localhost/api/tax/events${query ? '?' + query : ''}`;
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

describe('GET /api/tax/events, pending state', () => {
  it('returns events:[] + source:pending when TABLET_URL unset', async () => {
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest(''))).json();
    expect(json.events).toEqual([]);
    expect(json.source).toBe('pending');
  });

  it('returns pending on Tablet 5xx', async () => {
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 502 }));
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest(''))).json();
    expect(json.source).toBe('pending');
    expect(json.events).toEqual([]);
    fetchSpy.mockRestore();
  });
});

describe('GET /api/tax/events, NN-1 query-injection prevention', () => {
  it('clamps invalid jurisdiction to uk in upstream URL', async () => {
    let captured: string | undefined;
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      captured = String(input);
      return new Response(JSON.stringify({ events: [], source: 'tablet' }), { status: 200 });
    });
    const { GET } = await import('./route');
    // The injection attempt: `evil&extra=` would pollute the upstream query
    // string pre-NN-1. Post-fix: the closed-enum forces it to "uk" before
    // URLSearchParams re-encoding.
    await GET(makeRequest('jurisdiction=evil%26extra%3D1'));
    expect(captured).toBeDefined();
    expect(captured!).toContain('jurisdiction=uk');
    expect(captured!).not.toContain('extra=1');
    fetchSpy.mockRestore();
  });

  it('clamps invalid year to 2026 in upstream URL', async () => {
    let captured: string | undefined;
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      captured = String(input);
      return new Response(JSON.stringify({ events: [] }), { status: 200 });
    });
    const { GET } = await import('./route');
    await GET(makeRequest('year=1999'));
    expect(captured!).toContain('year=2026');
    fetchSpy.mockRestore();
  });

  it('maps Tablet disposal events to the table row shape', async () => {
    process.env.TABLET_URL = 'http://tablet-mock';
    // Real Tablet /events shape: realised disposals in native currency.
    const upstream = {
      events: [
        {
          date: '2026-06-08T03:05:02',
          asset: '0x128570b155efd3ba4fae8e482ebd851f483ef0bd8056503fc4e12ffd3e6ceedc',
          event: 'Disposal',
          proceeds: 1000.5,
          cost_basis: 900.25,
          gain: 100.25,
          currency: 'GBP',
        },
      ],
      cursor: '',
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(upstream), { status: 200 }),
    );
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest(''))).json();
    expect(json.source).toBe('scribe');
    expect(json.events).toHaveLength(1);
    const e = json.events[0];
    expect(e.proceedsUsd).toBe('£1,000.50');
    expect(e.costBasisUsd).toBe('£900.25');
    expect(e.gainUsd).toBe('£100.25');
    expect(e.gainDirection).toBe('up');
    expect(e.asset).toContain('0x1285');
    expect(e.eventLabel).toBe('Disposal');
    expect(e.date).toContain('2026');
    fetchSpy.mockRestore();
  });
});
