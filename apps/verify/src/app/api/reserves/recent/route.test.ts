import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

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
}> = {}) {
  return {
    root: '0x' + 'a'.repeat(64),
    blockNumber: '12345',
    timestamp: '1700000000',
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
        row({ root: '0xc1', timestamp: '1700000000' }),
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
        row({ root: '0xd3', timestamp: '1700000000' }),
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    expect(json.attestations).toHaveLength(1);
    expect(json.attestations[0].id).toBe('0xd3');
  });

  it('formats attestationTime as a non-empty locale string when valid', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [row({ root: '0xe1', timestamp: '1700000000' })],
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

  it('marks every valid row as pinned + status PASS', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [row({ root: '0xf1' })],
    });
    const { GET } = await import('./route');
    const json = await (await GET(new Request("http://localhost/api/reserves/recent"))).json();
    expect(json.attestations[0].pinned).toBe(true);
    expect(json.attestations[0].status).toBe('PASS');
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

// Audit U-11: ?window param drives the gql limit so the "24h / 7d / 30d"
// tabs in the UI fetch the right slice of attestations instead of being
// dead spans.
describe('GET /api/reserves/recent, window param', () => {
  function makeReq(window: string | undefined) {
    const url = new URL('http://localhost/api/reserves/recent');
    if (window) url.searchParams.set('window', window);
    return new Request(url.toString());
  }

  it('defaults to limit=24 when no window param is given', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(makeReq(undefined));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 24 });
  });

  it('window=24h → limit=24 (hourly attestations × 24h)', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(makeReq('24h'));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 24 });
  });

  it('window=7d → limit=168 (hourly × 7d)', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(makeReq('7d'));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 168 });
  });

  it('window=30d → limit=720 (hourly × 30d)', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(makeReq('30d'));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 720 });
  });

  it('unknown window falls back to limit=24 rather than rejecting', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(makeReq('99y'));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 24 });
  });

  it('GET with bare base-URL (no window param) defaults to 24', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    await GET(new Request('http://localhost/api/reserves/recent'));
    expect((gql as any).mock.calls[0][1]).toEqual({ limit: 24 });
  });
});
