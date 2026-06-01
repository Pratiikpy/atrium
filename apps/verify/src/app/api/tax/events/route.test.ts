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

  it('passes through valid Tablet success response', async () => {
    process.env.TABLET_URL = 'http://tablet-mock';
    const upstream = { events: [{ id: 'e1', kind: 'disposal' }], source: 'tablet' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(upstream), { status: 200 }),
    );
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest(''))).json();
    expect(json).toEqual(upstream);
    fetchSpy.mockRestore();
  });
});
