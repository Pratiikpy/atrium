import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';

/**
 * Pins the iteration-30 honesty gate that bridges three services:
 *
 *   services/archive/span_backtest.py  ──> writes JSON with `is_publishable`
 *   services/praetor-cli (backtest.rs) ──> checks flag before Safe payload
 *   apps/verify/api/research-attestation/latest ──> THIS ROUTE
 *
 * This route is the verify-app's defense layer: even if the upstream
 * services were bypassed and synthetic JSON reached IPFS, the route
 * refuses to render the attestation as `isPublishable: true`. The tests
 * here pin the load-bearing failure modes so a future refactor can't
 * silently widen them:
 *
 *   1. Schema v1 (pre-honesty-pass) → not publishable
 *   2. data_mode=synthetic-pairs    → not publishable
 *   3. data_mode=real-trades + is_publishable=true → publishable
 *   4. IPFS gateway fetch fails     → not publishable (fail-closed)
 *   5. Malformed ipfsHash           → not publishable + warning
 */

const originalFetch = global.fetch;
const originalGateway = process.env.IPFS_GATEWAY;
const originalScribeUrl = process.env.NEXT_PUBLIC_SCRIBE_URL;

beforeEach(() => {
  global.fetch = vi.fn();
  delete process.env.IPFS_GATEWAY;
  // The route's `gql()` helper throws ScribeNotConfigured if the env is
  // unset or pointing at the placeholder fallback. Set a real-looking URL
  // here so `gql()` reaches our mocked fetch instead of short-circuiting.
  process.env.NEXT_PUBLIC_SCRIBE_URL = 'https://test.scribe.local/query';
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalGateway === undefined) delete process.env.IPFS_GATEWAY;
  else process.env.IPFS_GATEWAY = originalGateway;
  if (originalScribeUrl === undefined) delete process.env.NEXT_PUBLIC_SCRIBE_URL;
  else process.env.NEXT_PUBLIC_SCRIBE_URL = originalScribeUrl;
  vi.restoreAllMocks();
});

/**
 * Mock dispatcher: Scribe POSTs and IPFS GETs share `fetch`. Discriminate
 * by URL so tests can wire each call independently.
 */
function mockTransport(opts: {
  scribeResponse: { ok?: boolean; status?: number; body: unknown };
  ipfsResponse?: { ok?: boolean; status?: number; body: unknown };
}): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: any) => {
    const url = typeof input === 'string' ? input : input.url ?? '';
    if (url.includes('/ipfs/')) {
      if (!opts.ipfsResponse) {
        return Promise.reject(new Error('no ipfs mock configured'));
      }
      return Promise.resolve(
        new Response(JSON.stringify(opts.ipfsResponse.body), {
          status: opts.ipfsResponse.status ?? (opts.ipfsResponse.ok === false ? 503 : 200),
        }),
      );
    }
    // Default: Scribe gql POST
    return Promise.resolve(
      new Response(JSON.stringify(opts.scribeResponse.body), {
        status: opts.scribeResponse.status ?? (opts.scribeResponse.ok === false ? 503 : 200),
      }),
    );
  });
}

const VALID_CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
const REAL_ROW = {
  ipfsHash: VALID_CID,
  tradesCount: '1000',
  collateralDeltaBps: '4700',
  timestampSeconds: '1716000000',
  notebookUrl: 'ipfs://Qm.../notebook.ipynb',
  blockNumber: '123456',
};

describe('GET /api/research-attestation/latest — no attestation', () => {
  it('returns 404 with reason when Scribe is empty', async () => {
    mockTransport({
      scribeResponse: { body: { data: { backtestAttestations: [] } } },
    });
    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.attestation).toBeNull();
    expect(json.reason).toBe('no_attestation_yet');
  });
});

describe('GET /api/research-attestation/latest — honesty gate branches', () => {
  it('schema v1 (no honesty field) → isPublishable false + warning', async () => {
    mockTransport({
      scribeResponse: { body: { data: { backtestAttestations: [REAL_ROW] } } },
      ipfsResponse: {
        body: {
          schema_version: 1,
          data_mode: 'unknown',
          // no is_publishable field — pre-honesty-pass schema
          trades_count: 1000,
        },
      },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attestation.isPublishable).toBe(false);
    expect(json.warning).toMatch(/pre-honesty-pass/);
  });

  it('synthetic-pairs → isPublishable false + warning naming data_mode', async () => {
    mockTransport({
      scribeResponse: { body: { data: { backtestAttestations: [REAL_ROW] } } },
      ipfsResponse: {
        body: {
          schema_version: 2,
          data_mode: 'synthetic-pairs',
          is_publishable: false,
          trades_count: 500,
        },
      },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attestation.isPublishable).toBe(false);
    expect(json.attestation.dataMode).toBe('synthetic-pairs');
    expect(json.warning).toMatch(/synthetic-pairs/);
    expect(json.warning).toMatch(/NOT publishable/);
  });

  it('real-trades + is_publishable=true → isPublishable true, no warning', async () => {
    mockTransport({
      scribeResponse: { body: { data: { backtestAttestations: [REAL_ROW] } } },
      ipfsResponse: {
        body: {
          schema_version: 2,
          data_mode: 'real-trades',
          is_publishable: true,
          trades_count: 25000,
          average_saving_bps: 4700,
        },
      },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attestation.isPublishable).toBe(true);
    expect(json.attestation.dataMode).toBe('real-trades');
    expect(json.warning).toBeUndefined();
  });

  it('IPFS gateway fetch fails → isPublishable false (fail-closed)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.url ?? '';
      if (url.includes('/ipfs/')) {
        return Promise.reject(new Error('ENOTFOUND ipfs.io'));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: { backtestAttestations: [REAL_ROW] } }), {
          status: 200,
        }),
      );
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attestation.isPublishable).toBe(false);
    // The fail-closed warning is the load-bearing assertion. Without this
    // the route could silently default to `isPublishable: undefined` when
    // the gateway is down, which UI consumers would render as truthy.
    expect(json.warning).toMatch(/IPFS gateway did not return/);
  });

  it('malformed ipfsHash → isPublishable false + warning, no IPFS fetch attempted', async () => {
    const badRow = { ...REAL_ROW, ipfsHash: 'not-a-cid' };
    let ipfsFetchCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.url ?? '';
      if (url.includes('/ipfs/')) {
        ipfsFetchCount += 1;
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: { backtestAttestations: [badRow] } }), {
          status: 200,
        }),
      );
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attestation.isPublishable).toBe(false);
    expect(json.warning).toMatch(/malformed/);
    // SSRF-gate property: a malformed CID must NEVER reach the gateway URL.
    // If this assertion fails, the regex was widened or bypassed.
    expect(ipfsFetchCount).toBe(0);
  });
});
