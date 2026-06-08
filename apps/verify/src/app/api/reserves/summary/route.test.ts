import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));
vi.mock('@/lib/lantern-source', () => ({
  tryGetLanternAttestationOnchain: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';
import { tryGetLanternAttestationOnchain } from '@/lib/lantern-source';

/**
 * Iter 65 audit fix: locks iter-34 (staleness flag), KK-13 (formatUsd
 * precision), KK-14 (parseTsOrNull guards ago()) on /api/reserves/summary.
 *
 * - iter-34 / isStale: server-side computed boolean. Threshold is 2x the
 *   10-min Lantern cadence (= 1200s) + 5 min grace (= 300s) = 1500s
 *   = 25 min (the cron moved from hourly to every-10-min in Phase
 *   theta.3). Anything older = stale; missing = stale by default
 *   ("unknown closer to stale than fresh" per honesty rule).
 * - KK-13 / formatUsd: aggregated TVL via BigInt accumulator, rendered
 *   via formatUsd. Pre-fix `Number(tvl) / 1e6` lost precision above
 *   ~$9 quadrillion micro-USDC.
 * - KK-14 / parseTsOrNull: gate the Scribe timestamp before passing
 *   to ago() so the route can never render "NaN s ago".
 *
 * The contract: source = 'scribe' on success, 'pending' on Scribe
 * failure. Scribe failure ALSO sets isStale=true with reason
 * "Scribe unavailable; freshness unknown", locks the honesty path.
 */

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const NOW_SEC = Math.floor(Date.now() / 1000);
const FRESH_TS = String(NOW_SEC - 10 * 60); // 10 min ago, under the 100-min threshold
const FRESH_45_TS = String(NOW_SEC - 45 * 60); // 45 min = one healthy self-loop cadence; must read FRESH
const STALE_TS = String(NOW_SEC - 200 * 60); // 200 min ago, well past the 100-min threshold

describe('GET /api/reserves/summary, KK-13 formatUsd precision', () => {
  it('renders TVL via formatUsd with $ prefix and locale separators', async () => {
    (gql as any).mockResolvedValue({
      counter: { totalTvlWei: '4000000' }, // $4.00, aggregated by the subgraph Counter
      lanternAttestations: [{ timestamp: FRESH_TS, leafCount: '8' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // $4.00 aggregated. formatUsd renders as "$4.00".
    expect(json.tvlUsd).toBe('$4.00');
    expect(json.lastAttestedTvlUsd).toBe('$4.00');
  });

  it('returns null TVL when zero balances aggregated (zero-honesty)', async () => {
    (gql as any).mockResolvedValue({
      counter: null,
      lanternAttestations: [{ timestamp: FRESH_TS, leafCount: '8' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // tvl=0n branch returns null, not "$0.00", same honesty pattern
    // as iter-36 in protocol/metrics.
    expect(json.tvlUsd).toBeNull();
  });

  it('preserves precision on large aggregated TVL (KK-13)', async () => {
    // 1B USDC = 1e15 micro-USDC, well past Number safe integer when
    // multiplied across many accounts. BigInt accumulator preserves.
    (gql as any).mockResolvedValue({
      counter: { totalTvlWei: '10000000000000000' }, // $10B, BigInt-precise
      lanternAttestations: [{ timestamp: FRESH_TS, leafCount: '8' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.tvlUsd).toBe('$10,000,000,000.00');
  });
});

describe('GET /api/reserves/summary, iter-34 staleness flag', () => {
  it('marks isStale=false when last attestation is fresh', async () => {
    (gql as any).mockResolvedValue({
      counter: null,
      lanternAttestations: [{ timestamp: FRESH_TS, leafCount: '8' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.isStale).toBe(false);
    expect(json.staleReason).toBeNull();
  });

  it('marks isStale=true when last attestation exceeds threshold', async () => {
    (gql as any).mockResolvedValue({
      counter: null,
      lanternAttestations: [{ timestamp: STALE_TS, leafCount: '8' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.isStale).toBe(true);
    expect(json.staleReason).toContain('since last publish');
    expect(json.staleReason).toContain('threshold');
  });

  it('marks isStale=true when no attestation indexed yet', async () => {
    // Honesty rule: unknown freshness is closer to stale than fresh.
    (gql as any).mockResolvedValue({
      counter: null,
      lanternAttestations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.isStale).toBe(true);
    expect(json.staleReason).toBe('no attestation indexed yet');
  });

  it('exposes the staleThresholdMin = 100 in the response', async () => {
    // 2x the 45-min Lantern self-loop cadence + 10-min grace = 100 min (cadence
    // correction 2026-06-08; was 25 min for the retired 10-min `*/10` cron).
    (gql as any).mockResolvedValue({
      counter: null,
      lanternAttestations: [{ timestamp: FRESH_TS, leafCount: '8' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.staleThresholdMin).toBe(100);
  });

  it('reads a 45-min-old attestation (one healthy self-loop cadence) as FRESH', async () => {
    // Regression lock for the cadence correction: a single 45-min publish gap is
    // the NORMAL healthy state under the self-loop, so it must NOT read stale
    // (pre-fix the 25-min threshold flagged it stale for ~20 min of every cycle).
    (gql as any).mockResolvedValue({
      counter: null,
      lanternAttestations: [{ timestamp: FRESH_45_TS, leafCount: '8' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.isStale).toBe(false);
    expect(json.staleReason).toBeNull();
  });
});

describe('GET /api/reserves/summary, KK-14 parseTsOrNull guard', () => {
  it('falls back to lastAttestedAgo:pending on malformed timestamp', async () => {
    (gql as any).mockResolvedValue({
      counter: null,
      lanternAttestations: [{ timestamp: 'NaN-text', leafCount: '8' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // Pre-KK-14: ago(parseInt("NaN-text")) = ago(NaN) → "NaN s ago".
    // Post-fix: parseTsOrNull → null → lastAttestedAgo = 'pending'.
    expect(json.lastAttestedAgo).toBe('pending');
    expect(json.isStale).toBe(true);
  });

  it('falls back to leafCount:null on non-numeric leafCount', async () => {
    (gql as any).mockResolvedValue({
      counter: null,
      lanternAttestations: [{ timestamp: FRESH_TS, leafCount: 'NaN' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.leafCount).toBeNull();
  });

  it('exposes valid leafCount as integer when present', async () => {
    (gql as any).mockResolvedValue({
      counter: null,
      lanternAttestations: [{ timestamp: FRESH_TS, leafCount: '16' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.leafCount).toBe(16);
  });
});

describe('GET /api/reserves/summary, Scribe outage', () => {
  // Robustness fix 2026-06-08: when Scribe is down, the route falls back to a
  // DIRECT on-chain LanternAttestor read (latest_block + that block's
  // timestamp) before degrading to "pending", so PoR freshness survives a
  // Graph Studio free-tier subgraph outage. Source becomes 'lantern-onchain'.
  it('falls back to on-chain LanternAttestor when Scribe is down (source:lantern-onchain, fresh)', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe 503'));
    (tryGetLanternAttestationOnchain as any).mockResolvedValue({
      blockNumber: 274900000n,
      root: '0x' + 'ab'.repeat(32),
      timestampSec: Math.floor(Date.now() / 1000) - 5 * 60, // 5 min ago
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('lantern-onchain');
    expect(json.isStale).toBe(false); // 5 min < 100 min threshold
    expect(json.lastAttestedAgo).not.toBe('pending'); // real age, e.g. "5m ago"
    expect(json.lastAttestedAgo).toMatch(/ago|now/i);
    // tvl/leafCount stay null - they live in the event, not contract storage.
    expect(json.tvlUsd).toBeNull();
    expect(json.leafCount).toBeNull();
  });

  it('marks the on-chain fallback stale when older than the threshold', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe 503'));
    (tryGetLanternAttestationOnchain as any).mockResolvedValue({
      blockNumber: 274000000n,
      root: '0x' + 'cd'.repeat(32),
      timestampSec: Math.floor(Date.now() / 1000) - 200 * 60, // 200 min > 100
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('lantern-onchain');
    expect(json.isStale).toBe(true);
  });

  it('returns source:pending only when BOTH Scribe AND the on-chain read fail', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe 503'));
    (tryGetLanternAttestationOnchain as any).mockResolvedValue(null);
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.tvlUsd).toBeNull();
    expect(json.lastAttestedTvlUsd).toBeNull();
    expect(json.lastAttestedAgo).toBe('pending');
    expect(json.leafCount).toBeNull();
    expect(json.isStale).toBe(true);
    expect(json.staleReason).toBe('Scribe unavailable; freshness unknown');
    // staleThresholdMin still surfaces, consumers may render a tile
    // labelled "threshold 100 min · unknown current age" honestly.
    expect(json.staleThresholdMin).toBe(100);
  });
});
