import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gql, ScribeNotConfigured } from './scribe-helpers';

/**
 * Locks the audit P-7 fix and every error-branch in the shared `gql()`
 * helper used by 5+ API routes. The helper sits at the foundation of:
 *   - /api/cohort/partners
 *   - /api/agents/leaderboard
 *   - /api/agents/summary
 *   - /api/portfolio/{activity,positions,summary,margin-health,buying-power}
 *   - /api/lantern/latest
 *
 * If `gql()` ever stops throwing on non-2xx / GraphQL `errors` / empty
 * `data`, every route silently returns malformed responses.
 *
 * Tests pin:
 *   1. Successful response → returns data (not the {data,errors} wrapper)
 *   2. Non-2xx → throws "Scribe NNN" with the status code
 *   3. GraphQL errors[] → throws with the first error message (NOT swallowed)
 *   4. data missing → throws "empty"
 *   5. Body shape: POST with content-type, JSON.stringify({query, variables})
 *   6. Audit P-7: AbortSignal.timeout(3000) wired into the fetch init
 */

const originalFetch = global.fetch;
const originalScribeUrl = process.env.NEXT_PUBLIC_SCRIBE_URL;
const originalServerScribeUrl = process.env.SCRIBE_URL;

beforeEach(() => {
  global.fetch = vi.fn();
  // Iteration 41: gql() now bails with ScribeNotConfigured when the env
  // is unset (or still on the PLACEHOLDER URL). Tests need a real-looking
  // URL so the call reaches the fetch mock. Restored in afterEach so the
  // test that EXPLICITLY tests the unconfigured path can clear the env.
  // SCRIBE_URL (the server-only override) is cleared so the local shell's
  // .env value cannot leak into tests and shadow NEXT_PUBLIC_SCRIBE_URL.
  delete process.env.SCRIBE_URL;
  process.env.NEXT_PUBLIC_SCRIBE_URL = 'https://test-scribe.example.invalid/graphql';
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalScribeUrl === undefined) delete process.env.NEXT_PUBLIC_SCRIBE_URL;
  else process.env.NEXT_PUBLIC_SCRIBE_URL = originalScribeUrl;
  if (originalServerScribeUrl === undefined) delete process.env.SCRIBE_URL;
  else process.env.SCRIBE_URL = originalServerScribeUrl;
  vi.restoreAllMocks();
});

describe('gql(), happy path', () => {
  it('returns the unwrapped data on a 200 with valid GraphQL response', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ data: { partners: [{ id: '0x1' }] } }), { status: 200 }),
    );
    const result = await gql<{ partners: Array<{ id: string }> }>('query { partners { id } }');
    expect(result).toEqual({ partners: [{ id: '0x1' }] });
  });

  it('passes variables through to the request body', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );
    await gql('query($id: ID!) { ok }', { id: '0xabc' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.query).toContain('$id: ID!');
    expect(body.variables).toEqual({ id: '0xabc' });
  });

  it('sends POST + JSON content-type', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );
    await gql('query { ok }');
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('wires AbortSignal into the fetch init (audit P-7)', async () => {
    // Audit P-7 fix: 3-second timeout. The fetch must carry an AbortSignal
    // so a slow Scribe can't stack hanging requests under TanStack Query's
    // 30s refetchInterval × 5+ routes.
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );
    await gql('query { ok }');
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.signal).toBeDefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('gql(), error paths', () => {
  it('throws "Scribe NNN" when response is non-2xx (404)', async () => {
    (global.fetch as any).mockResolvedValue(new Response('', { status: 404 }));
    await expect(gql('query { x }')).rejects.toThrow(/Scribe 404/);
  });

  it('throws "Scribe NNN" when response is non-2xx (500)', async () => {
    (global.fetch as any).mockResolvedValue(new Response('', { status: 500 }));
    await expect(gql('query { x }')).rejects.toThrow(/Scribe 500/);
  });

  it('throws "Scribe NNN" when response is 502 (subgraph reorg)', async () => {
    // Real-world: The Graph hosted service returns 502 during reorgs.
    // Routes that catch this exception must surface the source='pending'
    // honest empty-state.
    (global.fetch as any).mockResolvedValue(new Response('', { status: 502 }));
    await expect(gql('query { x }')).rejects.toThrow(/Scribe 502/);
  });

  it('throws the first GraphQL error message (NEVER swallowed)', async () => {
    // GraphQL puts errors in a separate array with status 200. If gql()
    // ever silently returns data when errors[] is non-empty, callers
    // would render corrupt UI.
    (global.fetch as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ message: 'Subgraph not synced past block 1234' }, { message: 'second error' }],
        }),
        { status: 200 },
      ),
    );
    // First error message must be the thrown message.
    await expect(gql('query { x }')).rejects.toThrow(/Subgraph not synced past block 1234/);
  });

  it('throws "empty" when data is missing from a successful response', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await expect(gql('query { x }')).rejects.toThrow(/empty/);
  });

  it('throws "empty" when data is explicitly null', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ data: null }), { status: 200 }),
    );
    await expect(gql('query { x }')).rejects.toThrow(/empty/);
  });

  it('propagates fetch network errors (no swallow)', async () => {
    (global.fetch as any).mockRejectedValue(new Error('ENOTFOUND scribe.useatrium.me'));
    await expect(gql('query { x }')).rejects.toThrow(/ENOTFOUND/);
  });

  it('propagates AbortError on timeout', async () => {
    // Audit P-7 timeout path. After 3 seconds the AbortSignal fires and
    // the fetch rejects with an AbortError. Routes must surface this as
    // the honest-pending state, not pretend the request succeeded.
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    (global.fetch as any).mockRejectedValue(abortErr);
    await expect(gql('query { x }')).rejects.toThrow(/aborted/);
  });
});

describe('gql(), invariants under chaos', () => {
  it('does not swallow errors when both data AND errors are present', async () => {
    // Edge case: some GraphQL servers return both partial data and a
    // non-empty errors array. The helper prioritizes the error.
    (global.fetch as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { x: 1 },
          errors: [{ message: 'Partial result; field y unresolved' }],
        }),
        { status: 200 },
      ),
    );
    await expect(gql('query { x y }')).rejects.toThrow(/Partial result/);
  });

  it('does not retry, caller controls retry policy (TanStack Query)', async () => {
    // Single fetch call per gql invocation. Retries belong in the
    // TanStack Query layer above this helper.
    (global.fetch as any).mockResolvedValue(new Response('', { status: 500 }));
    await expect(gql('query { x }')).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('gql(), iteration 41: PLACEHOLDER env detection', () => {
  it('throws ScribeNotConfigured when NEXT_PUBLIC_SCRIBE_URL is unset', async () => {
    // Override the test-setup default. Pre-fix this case was silent: the
    // route would 404 against the PLACEHOLDER URL, catch into "pending,"
    // operator never saw the config gap. Now: typed error class so the
    // route's err-handler can render a specific reason.
    delete process.env.NEXT_PUBLIC_SCRIBE_URL;
    await expect(gql('query { x }')).rejects.toBeInstanceOf(ScribeNotConfigured);
    // Critical: must throw BEFORE calling fetch. The error path must not
    // produce network traffic against the PLACEHOLDER URL.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws when NEXT_PUBLIC_SCRIBE_URL still contains the literal PLACEHOLDER string', async () => {
    // Operator did set the env but to the unedited template value. Same
    // shape as unset, refuse before fetch.
    process.env.NEXT_PUBLIC_SCRIBE_URL =
      'https://api.studio.thegraph.com/query/PLACEHOLDER/atrium/version/latest';
    await expect(gql('query { x }')).rejects.toBeInstanceOf(ScribeNotConfigured);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('prefers the server-only SCRIBE_URL over NEXT_PUBLIC_SCRIBE_URL', async () => {
    // Self-hosted cutover (2026-06-10): server routes read SCRIBE_URL (the
    // droplet graph-node); the NEXT_PUBLIC var stays a legacy fallback.
    process.env.SCRIBE_URL = 'https://server-scribe.example.invalid/graphql';
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );
    await gql('query { x }');
    expect((global.fetch as any).mock.calls[0][0]).toBe('https://server-scribe.example.invalid/graphql');
  });
});
