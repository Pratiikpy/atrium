import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

// Recent timestamp (1h ago) for mock rows. The route now drops attestations
// older than the requested window (added 2026-06-08 so "Last 24h" means 24
// hours of wall-clock, not the last 24 rows), so fixed historical timestamps
// like the old 1700000000 (2023) would be filtered out before the corrupt-row
// assertions could run. Using a now-relative value keeps the rows inside the
// default 24h window regardless of when the suite runs.
const RECENT_TS = String(Math.floor(Date.now() / 1000) - 3600);

/**
 * Iter 65 audit fix: locks MM-2 on /api/reserves/recent. Zero tests
 * pinned it pre-iter-65.
 *
 * - MM-2: pre-fix the route did unguarded `parseInt(...)` on three
 *   Scribe fields. On malformed values (real during subgraph reorgs):
 *     - blockNumber → NaN → UI rendered literal "NaN"
 *     - leafCount → NaN
 *     - timestamp → NaN * 1000 → `new Date(NaN).toLocaleString()`
 *       returned the literal string "Invalid Date"
 *   Now: drop entire rows that have ANY invalid field. Better to show
 *   fewer attestations than to ship "NaN" / "Invalid Date" into the
 *   proof-of-reserves history (the dashboard that's literally there
 *   to demonstrate the protocol is honest).
 */

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function row(overrides: Partial<{
  root: string;
  blockNumber: string;
  timestamp: string;
  leafCount: string;
  ipfsCid: string;
}> = {}) {
  return {
    root: '0x' + 'a'.repeat(64),
    blockNumber: '12345',
    timestamp: RECENT_TS,
    leafCount: '8',
    ...overrides,
  };
}

describe('GET /api/reserves/recent, MM-2 corrupt-row drop', () => {
  it('drops rows with non-numeric blockNumber', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [
        row({ root: '0xa1', blockNumber: '12345' }),
        row({ root: '0xa2', blockNumber: 'NaN' }),
        row({ root: '0xa3', blockNumber: '12347' }),
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    expect(json.attestations).toHaveLength(2);
    expect(json.attestations.find((a: any) => a.id === '0xa2')).toBeUndefined();
  });

  it('drops rows with non-numeric leafCount', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [
        row({ root: '0xb1', leafCount: '8' }),
        row({ root: '0xb2', leafCount: 'undefined' }),
        row({ root: '0xb3', leafCount: '16' }),
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    expect(json.attestations).toHaveLength(2);
  });

  it('drops rows with empty timestamp', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [
        row({ root: '0xc1', timestamp: RECENT_TS }),
        row({ root: '0xc2', timestamp: '' }),
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    expect(json.attestations).toHaveLength(1);
  });

  it('drops rows with negative or implausible timestamp', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [
        row({ root: '0xd1', timestamp: '-1' }),
        row({ root: '0xd2', timestamp: '999999999999' }),
        row({ root: '0xd3', timestamp: RECENT_TS }),
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    expect(json.attestations).toHaveLength(1);
    expect(json.attestations[0].id).toBe('0xd3');
  });

  it('formats attestationTime as a non-empty locale string when valid', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [row({ root: '0xe1', timestamp: RECENT_TS })],
    });
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    // Whatever the locale-formatted output is, it must NOT contain the
    // literal "Invalid Date" string. MM-2's whole point was preventing
    // that visible failure mode.
    expect(json.attestations[0].attestationTime).not.toContain('Invalid Date');
    expect(json.attestations[0].attestationTime).not.toContain('NaN');
    expect(typeof json.attestations[0].attestationTime).toBe('string');
    expect(json.attestations[0].attestationTime.length).toBeGreaterThan(0);
  });

  // Launch-review P0 (fake-as-live): a proof-of-reserves row may only show a
  // green PASS when the user can actually verify inclusion end-to-end, which
  // requires the Merkle tree pinned to IPFS. Derive PASS/PENDING from ipfsCid
  // instead of hardcoding PASS on every row.
  it('marks a row PASS + pinned only when its Merkle tree is pinned to IPFS', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [row({ root: '0xf1', ipfsCid: 'bafybeigdyrnotarealcidbutlongenough' })],
    });
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    expect(json.attestations[0].pinned).toBe(true);
    expect(json.attestations[0].status).toBe('PASS');
  });

  it('marks a row PENDING + not pinned when the tree is not pinned (no IPFS CID)', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [row({ root: '0xf2' })], // no ipfsCid → on-chain-only root
    });
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    expect(json.attestations[0].pinned).toBe(false);
    expect(json.attestations[0].status).toBe('PENDING');
  });

  it('treats a too-short / garbage ipfsCid as not pinned (PENDING)', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [row({ root: '0xf3', ipfsCid: 'x' })],
    });
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    expect(json.attestations[0].status).toBe('PENDING');
  });

  it('returns source:scribe on success', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [row({ root: '0xg1' })],
    });
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    expect(json.source).toBe('scribe');
  });

  it('returns source:pending on gql failure', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe outage'));
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    expect(json.source).toBe('pending');
    expect(json.attestations).toEqual([]);
  });
});

// Audit U-11 + 2026-06-08 follow-up: ?window drives BOTH a generous gql row cap
// AND a real wall-clock timestamp filter, so the "24h / 7d / 30d" tabs return the
// right slice of attestations by TIME. Pre-follow-up the windows were pure row
// limits (24/168/720) on a "Lantern publishes hourly" assumption; the self-loop
// publishes irregularly, so 24 rows spanned ~2 days and "Last 24h" lied.
describe('GET /api/reserves/recent, window param', () => {
  function makeReq(window: string | undefined) {
    const url = new URL('http://localhost/api/reserves/recent');
    if (window) url.searchParams.set('window', window);
    return new Request(url.toString());
  }

  it('defaults to row cap 120 when no window param is given', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(makeReq(undefined));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 120 });
  });

  it('window=24h → row cap 120', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(makeReq('24h'));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 120 });
  });

  it('window=7d → row cap 700', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(makeReq('7d'));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 700 });
  });

  it('window=30d → row cap 1000 (subgraph first: max)', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(makeReq('30d'));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 1000 });
  });

  it('unknown window falls back to row cap 120 rather than rejecting', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(makeReq('99y'));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 120 });
  });

  it('GET with bare base-URL (no window param) defaults to 120', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(new Request('http://localhost/api/reserves/recent'));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 120 });
  });

  it('drops attestations older than the requested window (24h) by real timestamp', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    (gql as any).mockResolvedValue({
      lanternAttestations: [
        row({ root: '0xfresh', timestamp: String(nowSec - 3600) }),       // 1h ago → in window
        row({ root: '0xstale', timestamp: String(nowSec - 2 * 86_400) }), // 2 days ago → out
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET(makeReq('24h'))).json();
    const ids = json.attestations.map((a: any) => a.id);
    expect(ids).toContain('0xfresh');
    expect(ids).not.toContain('0xstale');
  });
});
