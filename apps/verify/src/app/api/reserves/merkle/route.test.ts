import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Iter 65 audit fix: locks MM-3 on /api/reserves/merkle. Zero tests
 * pinned it pre-iter-65.
 *
 * - MM-3: pre-fix the route did `parseInt(last.leafCount, 10)` with
 *   no validation. On a malformed Scribe value, `leafCount=NaN`
 *   propagated through `Math.log2` → `depth=NaN` shipped to the UI
 *   ("Merkle depth NaN" rendered next to the Lantern proof). Now:
 *   strict-numeric gate (`^\d+$/` test) before parseInt, then
 *   Number.isFinite + negative guard, then depth = log2(max(n, 1)).
 */

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/reserves/merkle, MM-3 strict leafCount validation', () => {
  it('returns pending when no attestations indexed', async () => {
    (gql as any).mockResolvedValue({ lanternAttestations: [] });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.leafCount).toBeNull();
    expect(json.depth).toBeNull();
  });

  it('returns pending when leafCount is non-numeric (MM-3)', async () => {
    // Pre-MM-3: parseInt("NaN") returns NaN → Math.log2(NaN) = NaN →
    // depth: NaN shipped to UI. Post-fix: strict regex rejects.
    (gql as any).mockResolvedValue({
      lanternAttestations: [{ leafCount: 'not-a-number', root: '0xabc' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.leafCount).toBeNull();
    expect(json.depth).toBeNull();
  });

  it('returns pending when leafCount has trailing garbage', async () => {
    // parseInt("123abc") returns 123, which would mask bad data.
    // The MM-3 regex /^\d+$/ rejects trailing non-digits explicitly.
    (gql as any).mockResolvedValue({
      lanternAttestations: [{ leafCount: '123abc', root: '0xabc' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });

  it('returns pending when leafCount is empty', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [{ leafCount: '', root: '0xabc' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });

  it('computes depth as ceil(log2(leafCount)) on valid input', async () => {
    // 8 leaves → depth 3. 9 leaves → depth 4 (ceil log2 9 = 4).
    (gql as any).mockResolvedValue({
      lanternAttestations: [{ leafCount: '8', root: '0xabc' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('scribe');
    expect(json.leafCount).toBe(8);
    expect(json.depth).toBe(3);
  });

  it('returns depth=1 minimum even for leafCount=0', async () => {
    // Per the MM-3 formula `Math.max(1, ceil(log2(max(leafCount, 1))))`:
    // leafCount=0 → max(0, 1)=1, log2(1)=0, max(1, 0)=1.
    (gql as any).mockResolvedValue({
      lanternAttestations: [{ leafCount: '0', root: '0xabc' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.leafCount).toBe(0);
    expect(json.depth).toBe(1);
  });

  it('returns depth=1 for leafCount=1', async () => {
    (gql as any).mockResolvedValue({
      lanternAttestations: [{ leafCount: '1', root: '0xabc' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.depth).toBe(1);
  });

  it('returns pending on gql failure', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe outage'));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });
});
