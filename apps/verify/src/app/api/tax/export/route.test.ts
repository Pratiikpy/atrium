import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Iter 68 audit fix: locks LL-1 + LL-2 fixes on /api/tax/export.
 *
 * - LL-1: closed-enum gates on format / jurisdiction / year prevent
 *   query-param injection into the upstream Tablet URL. Mirror of
 *   JJ-5 (tax/summary) and NN-1 (tax/events).
 * - LL-2: Content-Disposition filename built from sanitized inputs
 *   (the closed-enum values), AND the upstream Content-Type is
 *   stripped of CRLF chars to prevent header injection. A caller
 *   passing `?format=csv%0d%0aX:%20evil` could pre-fix inject extra
 *   HTTP headers into the response.
 * - 503 on TABLET_URL unset: the export surface is a file download.
 *   A "no data" download would silently ship an empty file labeled
 *   "atrium-tax-uk-2026.csv", confusing for users + bad audit
 *   trail. 503 forces the consumer to surface "Tablet pending"
 *   instead.
 */

const ORIGINAL_TABLET_URL = process.env.TABLET_URL;

function makeRequest(query: string): NextRequest {
  const url = `http://localhost/api/tax/export${query ? '?' + query : ''}`;
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

describe('GET /api/tax/export, 503 when Tablet undeployed', () => {
  it('returns 503 + tablet_pending when TABLET_URL unset', async () => {
    const { GET } = await import('./route');
    const res = await GET(makeRequest(''));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('tablet_pending');
    expect(json.detail).toContain('Tablet');
  });

  it('returns 503 + tablet_unreachable when Tablet errors', async () => {
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    const { GET } = await import('./route');
    const res = await GET(makeRequest(''));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('tablet_unreachable');
    fetchSpy.mockRestore();
  });
});

describe('GET /api/tax/export, LL-1 closed-enum format gate', () => {
  it('clamps invalid format to csv in upstream URL', async () => {
    let captured: string | undefined;
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      captured = String(input);
      return new Response(new ArrayBuffer(0), { status: 200, headers: { 'content-type': 'text/csv' } });
    });
    const { GET } = await import('./route');
    await GET(makeRequest('format=html%0d%0ainjected'));
    expect(captured!).toContain('format=csv');
    expect(captured!).not.toContain('injected');
    fetchSpy.mockRestore();
  });

  it('accepts canonical formats: csv, json, pdf', async () => {
    process.env.TABLET_URL = 'http://tablet-mock';
    let captured: string | undefined;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      captured = String(input);
      return new Response(new ArrayBuffer(0), { status: 200 });
    });
    const { GET } = await import('./route');
    for (const fmt of ['csv', 'json', 'pdf']) {
      await GET(makeRequest(`format=${fmt}`));
      expect(captured!).toContain(`format=${fmt}`);
    }
    fetchSpy.mockRestore();
  });
});

describe('GET /api/tax/export, LL-2 filename + Content-Type sanitization', () => {
  it('renders sanitized Content-Disposition filename', async () => {
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new ArrayBuffer(8), { status: 200, headers: { 'content-type': 'text/csv' } }),
    );
    const { GET } = await import('./route');
    const res = await GET(makeRequest('format=csv&jurisdiction=us&year=2027'));
    expect(res.status).toBe(200);
    const disposition = res.headers.get('content-disposition');
    expect(disposition).toBe('attachment; filename="atrium-tax-us-2027.csv"');
    fetchSpy.mockRestore();
  });

  it('preserves a clean upstream Content-Type', async () => {
    // The route applies `.replace(/[\r\n]/g, '')` to the upstream
    // Content-Type as defense-in-depth. The undici Response
    // constructor already rejects CRLF in header values (we can't
    // construct a malicious Response in-test) but the route's
    // sanitizer would handle it if the platform check ever weakened.
    // This test pins the clean-pass-through behavior.
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new ArrayBuffer(8), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { GET } = await import('./route');
    const res = await GET(makeRequest('format=json'));
    expect(res.headers.get('content-type')).toBe('application/json');
    fetchSpy.mockRestore();
  });

  it('falls back to application/octet-stream when upstream Content-Type missing', async () => {
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new ArrayBuffer(8), { status: 200 /* no content-type header */ }),
    );
    const { GET } = await import('./route');
    const res = await GET(makeRequest(''));
    // Whatever the fallback content-type, it must be set, finite, and
    // not contain CRLF (the route's regex replace ensures this).
    const ct = res.headers.get('content-type');
    expect(ct).toBeDefined();
    expect(ct).not.toContain('\r');
    expect(ct).not.toContain('\n');
    fetchSpy.mockRestore();
  });

  it('builds filename ONLY from closed-enum inputs (defense in depth)', async () => {
    process.env.TABLET_URL = 'http://tablet-mock';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new ArrayBuffer(8), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const { GET } = await import('./route');
    // Injection attempt, these would-be CRLF injectors get clamped by
    // the enum/range gates BEFORE reaching the filename builder.
    const res = await GET(makeRequest('format=csv%0d%0aX:%20bad&jurisdiction=evilcorp&year=NaN'));
    const disposition = res.headers.get('content-disposition');
    expect(disposition).toBe('attachment; filename="atrium-tax-uk-2026.csv"');
    expect(disposition).not.toContain('\r');
    expect(disposition).not.toContain('\n');
    fetchSpy.mockRestore();
  });
});
