import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Iter 67 audit fix: locks the LL-6 fixes on
 * /api/settings/connected-sites. Zero tests pinned them pre-iter-67.
 *
 * - LL-6 host validation: a strict regex rejects URLs, CRLF
 *   injection, JS expressions in the host field. Both POST and
 *   DELETE per-host paths apply the same gate.
 * - LL-6 MAX_SESSIONS cap: in-memory map capped at 100 entries so
 *   a flood can't exhaust process memory. Oldest entry evicted on
 *   overflow (FIFO via Map insertion order).
 * - GET / POST / DELETE state-machine: empty → 'pending', populated
 *   → 'postern', DELETE ?all=1 wipes everything, DELETE { host }
 *   removes a single entry.
 */

// Each test does a fresh import to reset the module-level `sessions` Map.
// vitest's vi.resetModules() in beforeEach gives us per-test isolation.
import { vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function makeRequest(method: string, query: string, body?: unknown): NextRequest {
  const url = `http://localhost/api/settings/connected-sites${query ? '?' + query : ''}`;
  return new NextRequest(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/settings/connected-sites, empty state', () => {
  it('returns source:pending when no sessions registered', async () => {
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest('GET', ''))).json();
    expect(json.source).toBe('pending');
    expect(json.sites).toEqual([]);
  });
});

describe('POST /api/settings/connected-sites, host validation (LL-6)', () => {
  it('accepts a canonical hostname', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeRequest('POST', '', { host: 'app.uniswap.org' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.host).toBe('app.uniswap.org');
  });

  it('rejects a URL with scheme prefix', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeRequest('POST', '', { host: 'https://app.uniswap.org' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_host');
  });

  it('rejects CRLF injection attempts', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeRequest('POST', '', { host: "app.uniswap.org\r\nX-Evil: 1" }));
    expect(res.status).toBe(400);
  });

  it('rejects a bare TLD-less single label', async () => {
    // HOST_REGEX requires at least one dot.
    const { POST } = await import('./route');
    const res = await POST(makeRequest('POST', '', { host: 'localhost' }));
    expect(res.status).toBe(400);
  });

  it('rejects a number / non-string host', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeRequest('POST', '', { host: 12345 }));
    expect(res.status).toBe(400);
  });

  it('rejects an empty body / missing host', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeRequest('POST', '', {}));
    expect(res.status).toBe(400);
  });

  it('rejects a non-JSON body', async () => {
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/settings/connected-sites', {
      method: 'POST',
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET / POST / DELETE state machine', () => {
  it('GET returns the registered session with source:postern after POST', async () => {
    const route = await import('./route');
    await route.POST(makeRequest('POST', '', { host: 'app.useatrium.me' }));
    const json = await (await route.GET(makeRequest('GET', ''))).json();
    expect(json.source).toBe('postern');
    expect(json.sites).toHaveLength(1);
    expect(json.sites[0].host).toBe('app.useatrium.me');
    // lastUsedAgo formatting is "now" / "X min ago" / "X hour ago".
    expect(typeof json.sites[0].lastUsedAgo).toBe('string');
  });

  it('DELETE { host } removes only that session', async () => {
    const route = await import('./route');
    await route.POST(makeRequest('POST', '', { host: 'app.a.com' }));
    await route.POST(makeRequest('POST', '', { host: 'app.b.com' }));
    const delRes = await route.DELETE(makeRequest('DELETE', '', { host: 'app.a.com' }));
    expect(delRes.status).toBe(200);
    const delJson = await delRes.json();
    expect(delJson.revoked).toBe('app.a.com');

    const json = await (await route.GET(makeRequest('GET', ''))).json();
    expect(json.sites).toHaveLength(1);
    expect(json.sites[0].host).toBe('app.b.com');
  });

  it('DELETE ?all=1 wipes every session', async () => {
    const route = await import('./route');
    await route.POST(makeRequest('POST', '', { host: 'app.a.com' }));
    await route.POST(makeRequest('POST', '', { host: 'app.b.com' }));
    const delRes = await route.DELETE(makeRequest('DELETE', 'all=1'));
    const delJson = await delRes.json();
    expect(delJson.revoked).toBe('all');

    const json = await (await route.GET(makeRequest('GET', ''))).json();
    expect(json.sites).toEqual([]);
    expect(json.source).toBe('pending');
  });

  it('DELETE rejects invalid host with 400', async () => {
    const route = await import('./route');
    const res = await route.DELETE(makeRequest('DELETE', '', { host: 'https://evil.com' }));
    expect(res.status).toBe(400);
  });
});

describe('LL-6 MAX_SESSIONS cap (DoS protection)', () => {
  it('evicts the oldest entry when MAX_SESSIONS=100 reached', async () => {
    const route = await import('./route');
    // Fill to cap + 1. The first inserted host (a0.com) should be evicted
    // when the 101st insert happens.
    for (let i = 0; i < 100; i++) {
      await route.POST(makeRequest('POST', '', { host: `a${i}.com` }));
    }
    await route.POST(makeRequest('POST', '', { host: 'overflow.com' }));

    const json = await (await route.GET(makeRequest('GET', ''))).json();
    expect(json.sites).toHaveLength(100);
    const hosts = json.sites.map((s: any) => s.host);
    expect(hosts).toContain('overflow.com');
    // The oldest insert (a0.com) was evicted to make room.
    expect(hosts).not.toContain('a0.com');
  });

  it('re-posting an existing host does NOT evict and does NOT grow the map', async () => {
    const route = await import('./route');
    for (let i = 0; i < 100; i++) {
      await route.POST(makeRequest('POST', '', { host: `b${i}.com` }));
    }
    // Re-POST an already-registered host. The size cap check skips eviction
    // because `sessions.has(body.host)` is true.
    await route.POST(makeRequest('POST', '', { host: 'b50.com' }));

    const json = await (await route.GET(makeRequest('GET', ''))).json();
    expect(json.sites).toHaveLength(100);
    // b0 was NOT evicted because the re-POST didn't push over the cap.
    const hosts = json.sites.map((s: any) => s.host);
    expect(hosts).toContain('b0.com');
  });
});
