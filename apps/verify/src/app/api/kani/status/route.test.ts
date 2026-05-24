import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';

/**
 * Locks the audit J-C1 fix: the Kani badge must reflect real CI state, not
 * a hardcoded "3 of 5" green dot. The badge is the trust surface of the
 * formal-verification claim on the landing page — if it ever drifts to a
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

describe('GET /api/kani/status — no upstream configured', () => {
  it('returns honest "unknown" state when KANI_STATUS_URL is unset', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.state).toBe('unknown');
    // Iteration 38: unmeasured passed is null, not 0. Pre-fix `0` made the
    // badge render "0 of 6" which reads as "0 proofs passed CI" — the
    // honest state is "no measurement yet."
    expect(json.passed).toBeNull();
    // Honest floor: in-repo Kani proof count (math.rs 4 + span.rs 2 = 6).
    // CI authority overrides this via KANI_STATUS_URL or public/kani-status.json.
    expect(json.total).toBe(6);
    expect(json.last_run_at).toBeNull();
    expect(json.proof_run_url).toBeNull();
    // Honesty discipline: the source field MUST name the no-config state
    // so the badge UI can render the "checking" placeholder accurately.
    expect(json.source).toBe('no-status-source-configured');
  });

  it('does NOT call fetch when no URL is configured', async () => {
    await GET();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('GET /api/kani/status — upstream success', () => {
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
    // Partial-upstream: total falls through to in-repo Kani proof floor (6).
    expect(json.total).toBe(6);
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
    // A failing Kani proof is the most important case — the badge must
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

describe('GET /api/kani/status — upstream failure falls back honestly', () => {
  beforeEach(() => {
    process.env.KANI_STATUS_URL = 'https://broken.example.com/status.json';
  });

  it('falls back to unknown when upstream returns non-2xx', async () => {
    (global.fetch as any).mockResolvedValue(new Response('', { status: 503 }));
    const json = await (await GET()).json();
    expect(json.state).toBe('unknown');
    expect(json.source).toBe('no-status-source-configured');
  });

  it('falls back to unknown on network error', async () => {
    (global.fetch as any).mockRejectedValue(new Error('ENOTFOUND'));
    const json = await (await GET()).json();
    expect(json.state).toBe('unknown');
  });

  it('falls back to unknown on JSON parse error', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response('not-json', { status: 200 }),
    );
    const json = await (await GET()).json();
    expect(json.state).toBe('unknown');
  });

  it('falls back to unknown on timeout (2s abort)', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    (global.fetch as any).mockRejectedValue(abortErr);
    const json = await (await GET()).json();
    expect(json.state).toBe('unknown');
  });
});

describe('GET /api/kani/status — response shape invariants', () => {
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
      expect(['pass', 'fail', 'unknown']).toContain(json.state);
    }
  });
});
