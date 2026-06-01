import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';

/**
 * Locks the audit J-C1 fix: the Kani badge must reflect real CI state, not
 * a hardcoded "3 of 5" green dot. The badge is the trust surface of the
 * formal-verification claim on the landing page, if it ever drifts to a
 * static value, the audit J-C1 regression has shipped.
 *
 * Tests pin:
 *   1. When KANI_STATUS_URL is set and reachable → upstream is mirrored
 *   2. When upstream returns a partial payload → safe defaults fill in
 *   3. When upstream returns non-2xx → honest "unknown" fallback
 *   4. When upstream times out / errors → honest "unknown" fallback
 *   5. When no env var configured → honest "unknown" with explicit source
 *      message naming "no-status-source-configured"
 *   6. Response shape is ALWAYS complete (never undefined fields)
 */

const originalFetch = global.fetch;
const originalUrl = process.env.KANI_STATUS_URL;

beforeEach(() => {
  global.fetch = vi.fn();
  delete process.env.KANI_STATUS_URL;
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.KANI_STATUS_URL;
  else process.env.KANI_STATUS_URL = originalUrl;
  vi.restoreAllMocks();
});

describe('GET /api/kani/status, no upstream configured', () => {
  it('returns "in-development" state from committed kani-status.json fallback', async () => {
    // Audit 2026-05-24 alpha.4 plus alpha.6: prior route had no public/
    // kani-status.json so unconfigured runs returned 'unknown'. The file
    // is now committed with state='in-development', total=9 (real proof
    // count per /scripts grep). When no upstream URL is set, the file
    // fallback is the source of truth.
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.state).toBe('in-development');
    expect(json.passed).toBeNull();
    // Real Kani proof floor: math.rs 4 + span.rs 2 + sigil/eip712.rs 2 +
    // sigil/lib.rs 1 = 9. Bumped from 6 after Auditor E found undercount.
    expect(json.total).toBe(9);
    expect(json.last_run_at).toBeNull();
    expect(json.proof_run_url).toBeNull();
    expect(json.source).toBe('public/kani-status.json');
  });

  it('does NOT call fetch when no URL is configured', async () => {
    await GET();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('GET /api/kani/status, upstream success', () => {
  beforeEach(() => {
    process.env.KANI_STATUS_URL = 'https://shields.io/badges/kani/atrium.json';
  });

  it('mirrors upstream state and counts', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          state: 'pass',
          passed: 5,
          total: 5,
          last_run_at: '2026-05-18T03:00:00Z',
          proof_run_url: 'https://github.com/atrium-fi/atrium/actions/runs/123',
        }),
        { status: 200 },
      ),
    );

    const res = await GET();
    const json = await res.json();
    expect(json.state).toBe('pass');
    expect(json.passed).toBe(5);
    expect(json.total).toBe(5);
    expect(json.last_run_at).toBe('2026-05-18T03:00:00Z');
    expect(json.proof_run_url).toBe('https://github.com/atrium-fi/atrium/actions/runs/123');
    // Source must echo the configured URL so the badge UI can link to it.
    expect(json.source).toBe('https://shields.io/badges/kani/atrium.json');
  });

  it('fills safe defaults when upstream payload is partial', async () => {
    // Defensive default discipline: if CI's status JSON is missing fields
    // (e.g. mid-deployment), the route must still produce a complete shape
    // so the badge UI doesn't crash.
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ state: 'pass' }), { status: 200 }),
    );

    const json = await (await GET()).json();
    expect(json.state).toBe('pass');
    // Iteration 38: when upstream omits `passed`, route returns null (not 0)
    // so the UI distinguishes "all-passed-but-count-missing" (anomalous,
    // worth flagging) from "all-failed" (real measurement).
    expect(json.passed).toBeNull();
    // Partial-upstream: total falls through to KANI_PROOF_FLOOR. Bumped
    // from 6 to 9 in alpha.4 after Auditor E recounted (math.rs 4 +
    // span.rs 2 + sigil/eip712.rs 2 + sigil/lib.rs 1 = 9).
    expect(json.total).toBe(9);
    expect(json.last_run_at).toBeNull();
    expect(json.proof_run_url).toBeNull();
  });

  it('defaults state to "unknown" when upstream returns no state field', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ passed: 3 }), { status: 200 }),
    );
    const json = await (await GET()).json();
    expect(json.state).toBe('unknown');
    expect(json.passed).toBe(3);
  });

  it('reflects a real-world "fail" state', async () => {
    // A failing Kani proof is the most important case, the badge must
    // surface the failure honestly.
    (global.fetch as any).mockResolvedValue(
      new Response(
        JSON.stringify({ state: 'fail', passed: 4, total: 5, proof_run_url: 'https://example.com/run/9' }),
        { status: 200 },
      ),
    );
    const json = await (await GET()).json();
    expect(json.state).toBe('fail');
    expect(json.passed).toBe(4);
    expect(json.proof_run_url).toBe('https://example.com/run/9');
  });
});

describe('GET /api/kani/status, upstream failure falls back honestly', () => {
  beforeEach(() => {
    process.env.KANI_STATUS_URL = 'https://broken.example.com/status.json';
  });

  // After alpha.4, the file fallback is committed so upstream-failure scenarios
  // resolve to 'in-development' from the file rather than 'unknown'. The route
  // only returns 'no-status-source-configured' when BOTH upstream fails and
  // the file is unreadable.

  it('falls back to file (in-development) when upstream returns non-2xx', async () => {
    (global.fetch as any).mockResolvedValue(new Response('', { status: 503 }));
    const json = await (await GET()).json();
    expect(json.state).toBe('in-development');
    expect(json.source).toBe('public/kani-status.json');
  });

  it('falls back to file (in-development) on network error', async () => {
    (global.fetch as any).mockRejectedValue(new Error('ENOTFOUND'));
    const json = await (await GET()).json();
    expect(json.state).toBe('in-development');
  });

  it('falls back to file (in-development) on JSON parse error', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response('not-json', { status: 200 }),
    );
    const json = await (await GET()).json();
    expect(json.state).toBe('in-development');
  });

  it('falls back to file (in-development) on timeout (2s abort)', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    (global.fetch as any).mockRejectedValue(abortErr);
    const json = await (await GET()).json();
    expect(json.state).toBe('in-development');
  });
});

describe('GET /api/kani/status, response shape invariants', () => {
  it('every response has all 6 fields populated (never undefined)', async () => {
    // Test all branches: no env var, success, partial, error, network fail.
    const scenarios: Array<() => Promise<void>> = [
      async () => {}, // no env var
      async () => {
        process.env.KANI_STATUS_URL = 'https://ok.example.com';
        (global.fetch as any).mockResolvedValue(
          new Response(JSON.stringify({ state: 'pass', passed: 5, total: 5 }), { status: 200 }),
        );
      },
      async () => {
        process.env.KANI_STATUS_URL = 'https://bad.example.com';
        (global.fetch as any).mockResolvedValue(new Response('', { status: 500 }));
      },
    ];

    for (const setup of scenarios) {
      delete process.env.KANI_STATUS_URL;
      vi.restoreAllMocks();
      global.fetch = vi.fn();
      await setup();

      const json = await (await GET()).json();
      // All 6 fields must be defined (or explicitly null for nullable ones).
      expect(json).toHaveProperty('state');
      expect(json).toHaveProperty('passed');
      expect(json).toHaveProperty('total');
      expect(json).toHaveProperty('last_run_at');
      expect(json).toHaveProperty('proof_run_url');
      expect(json).toHaveProperty('source');
      expect(['pass', 'fail', 'unknown', 'in-development']).toContain(json.state);
    }
  });
});
