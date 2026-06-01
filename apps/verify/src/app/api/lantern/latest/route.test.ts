import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Iter 70 audit fix: locks J-M10 + NN-3 + TT-17 on /api/lantern/latest.
 *
 * - J-M10: generic was `{ backtestAttestations: any[] }` but query
 *   asked for `lanternAttestations`. Type mismatch + any cast meant
 *   no compile-time check on the actual shape.
 * - NN-3: Scribe returns numeric fields as strings (BigInt-as-string).
 *   Prior code typed them as number and let downstream coerce -
 *   `new Date(malformed * 1000)` rendered "Invalid Date" in UI.
 *   Now: strict-numeric parse, return 404 if any field is corrupt.
 * - TT-17: LanternAttestor.publish() does NOT carry ipfsCid in its
 *   on-chain event. Subgraph leaves ipfsCid unset; if shipped, the
 *   dashboard's verify-inclusion call fails 400. Treat missing
 *   ipfsCid as corrupt → 404 empty state.
 *
 * Contract: 404 on missing/corrupt rows (NOT empty 200), 503 on Scribe
 * outage. The 404/503 split lets the dashboard render an empty state
 * for "no data yet" but a banner for "we don't know."
 */

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function validRow(overrides: Partial<{
  root: string;
  blockNumber: string;
  timestamp: string;
  leafCount: string;
  ipfsCid: string;
}> = {}) {
  return {
    root: '0x' + 'a'.repeat(64),
    blockNumber: '12345',
    timestamp: '1700000000',
    leafCount: '8',
    ipfsCid: 'QmXyZ1234567890abcdef',
    ...overrides,
  };
}

describe('GET /api/lantern/latest, 404 empty states', () => {
  it('returns 404 + exists:false when no attestation indexed', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.exists).toBe(false);
  });

  it('returns 404 reason:corrupt_indexed_row on malformed blockNumber (NN-3)', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [validRow({ blockNumber: 'NaN' })],
    });
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.exists).toBe(false);
    expect(json.reason).toBe('corrupt_indexed_row');
  });

  it('returns 404 corrupt_indexed_row on malformed timestamp', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [validRow({ timestamp: '' })],
    });
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.reason).toBe('corrupt_indexed_row');
  });

  it('returns 404 corrupt_indexed_row on malformed leafCount', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [validRow({ leafCount: 'undefined' })],
    });
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.reason).toBe('corrupt_indexed_row');
  });

  it('returns 404 corrupt_root on malformed root hex', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [validRow({ root: '0xZZ' + 'a'.repeat(62) })],
    });
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.reason).toBe('corrupt_root');
  });

  it('returns 404 corrupt_root on wrong-length root', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [validRow({ root: '0x' + 'a'.repeat(40) })],
    });
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.reason).toBe('corrupt_root');
  });

  it('returns 200 + ipfsPinned:false on absent ipfsCid (real root, tree not pinned)', async () => {
    // A real on-chain attestation with no IPFS pin must be SHOWN, not 404'd
    // (the contract + publish path allow an empty CID). Only the inclusion-
    // verify sub-feature needs the pinned tree.
    (gql as any).mockResolvedValue({
      lanternAttestations: [validRow({ ipfsCid: '' })],
    });
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ipfsPinned).toBe(false);
    expect(json.root).toBeDefined();
    expect(json.ipfsCid).toBe('');
  });

  it('returns 200 + ipfsPinned:false on short ipfsCid (< 10 chars)', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [validRow({ ipfsCid: 'short' })],
    });
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ipfsPinned).toBe(false);
  });
});

describe('GET /api/lantern/latest, happy path', () => {
  it('returns wire-shape JSON on valid row', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [validRow()],
    });
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.root).toBe('0x' + 'a'.repeat(64));
    expect(json.blockNumber).toBe(12345);
    expect(json.timestamp).toBe(1700000000);
    expect(json.leafCount).toBe(8);
    expect(json.ipfsCid).toBe('QmXyZ1234567890abcdef');
  });

  it('numeric fields are typed as number on wire (not BigInt-as-string)', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [validRow({ blockNumber: '99', timestamp: '1700000500', leafCount: '16' })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // NN-3 fix: numeric fields parsed server-side. UI can do math
    // directly without coercion.
    expect(typeof json.blockNumber).toBe('number');
    expect(typeof json.timestamp).toBe('number');
    expect(typeof json.leafCount).toBe('number');
  });
});

describe('GET /api/lantern/latest, 503 on Scribe outage', () => {
  it('returns 503 + scribe_unavailable (NOT silent 404)', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe down'));
    const { GET } = await import('./route');
    const res = await GET();
    // Load-bearing: 503 (not 404) so the dashboard can distinguish
    // "no data yet" (empty state) from "we can't reach Scribe"
    // (outage banner). Both ship with `exists: false` semantics but
    // the status code is the load-bearing signal.
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('scribe_unavailable');
    expect(json.detail).toBeDefined();
  });
});
