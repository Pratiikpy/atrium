import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock gql + loadDeploymentRegistry BEFORE importing the route (both
// are static-imported at module load).
vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));
vi.mock('@/lib/deployments-registry', () => ({
  loadDeploymentRegistry: vi.fn(),
}));

import { GET } from './route';
import { gql } from '@/lib/scribe-helpers';
import { loadDeploymentRegistry } from '@/lib/deployments-registry';
import { VENUE_COUNT } from '@/lib/venues';

/**
 * Iter 62 audit fix: locks four documented audit fixes on
 * /api/protocol/metrics that had zero tests pinning them. The route
 * powers the landing-page "numbers" section; the audit-fix shape is
 * the canonical "live data discipline" enforcement for that surface
 * per docs/conventions/ui.md.
 *
 * Pre-iter-62 a refactor reverting any of these would slip past CI:
 *
 * - Iter-35 / venuesDeployed naming: the field used to be
 *   `venuesLive`, but the count was measured from the deployment
 *   registry (presence of a non-zero address), NOT from on-chain
 *   `get_venue_health()`. Renamed because a deployed-but-broken
 *   adapter would have shown as "live."
 * - Iter-36 / registeredAgents: success path returns `null`, not a
 *   hardcoded `0`. The hardcoded 0 was indistinguishable from a
 *   real measured zero — same label-lie shape as iter-35.
 * - Iter-39 / venuesDeployed.count on Scribe outage: error path
 *   returns `count: null`, not `0`. Pre-fix the landing rendered
 *   "0 / 7 deployed" during a Scribe outage — a fake-zero shape.
 * - MM-1 / formatUsd: aggregated TVL across N margin accounts in
 *   micro-USDC can exceed Number.MAX_SAFE_INTEGER. formatUsd uses
 *   BigInt division to preserve precision.
 */

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/protocol/metrics — happy path (iter 35/36 + MM-1)', () => {
  it('uses venuesDeployed field name (not venuesLive) per iter-35', async () => {
    (gql as any).mockResolvedValue({
      marginAccounts: [{ collateralValueWei: '1000000' }],
      positions: [],
    });
    (loadDeploymentRegistry as any).mockResolvedValue({ contracts: {} });

    const res = await GET();
    const json = await res.json();

    // The field MUST be venuesDeployed, not venuesLive. The rename was
    // the iter-35 honesty fix: deployed != operational.
    expect(json).toHaveProperty('venuesDeployed');
    expect(json).not.toHaveProperty('venuesLive');
  });

  it('returns registeredAgents:null per iter-36 (not hardcoded 0)', async () => {
    (gql as any).mockResolvedValue({
      marginAccounts: [{ collateralValueWei: '1000000' }],
      positions: [],
    });
    (loadDeploymentRegistry as any).mockResolvedValue({ contracts: {} });

    const json = await (await GET()).json();
    // Iter-36 audit fix: success path returns null, not 0. A real
    // measured-zero would be visually identical to a hardcoded zero,
    // misleading users about "registry pending" status.
    expect(json.registeredAgents).toBeNull();
    expect(json.agentsWithOpenPositions).toBeNull();
    expect(json.codex24hQueries).toBeNull();
  });

  it('returns source:scribe on successful gql', async () => {
    (gql as any).mockResolvedValue({
      marginAccounts: [{ collateralValueWei: '5000000' }],
      positions: [{ id: '0xaa' }],
    });
    (loadDeploymentRegistry as any).mockResolvedValue({ contracts: {} });

    const json = await (await GET()).json();
    expect(json.source).toBe('scribe');
  });

  it('aggregates TVL across margin accounts', async () => {
    (gql as any).mockResolvedValue({
      marginAccounts: [
        { collateralValueWei: '1000000' }, // 1 USDC
        { collateralValueWei: '2500000' }, // 2.5 USDC
        { collateralValueWei: '500000' }, // 0.5 USDC
      ],
      positions: [],
    });
    (loadDeploymentRegistry as any).mockResolvedValue({ contracts: {} });

    const json = await (await GET()).json();
    // 4_000_000 micro-USDC = $4.00. formatUsd format is "$<int>.<frac>"
    // with locale thousands separators.
    expect(json.testnetTvlUsd).toBe('$4.00');
  });

  it('returns null TVL when no margin accounts exist (zero-honesty)', async () => {
    (gql as any).mockResolvedValue({
      marginAccounts: [],
      positions: [],
    });
    (loadDeploymentRegistry as any).mockResolvedValue({ contracts: {} });

    const json = await (await GET()).json();
    // Per the route's `tvlWei > 0n ? formatUsd(...) : null` semantics,
    // an empty population returns null, not "0.00". Same fake-zero
    // honesty pattern as iter-36 / iter-39.
    expect(json.testnetTvlUsd).toBeNull();
  });

  it('handles large aggregated TVL via formatUsd (MM-1)', async () => {
    // 2^53 - 1 = 9_007_199_254_740_991 micro-USDC ≈ $9 trillion. Two
    // accounts each at half that aggregate to a value that exceeds the
    // safe-integer boundary in micro-USDC but lands well within
    // safe-integer range after the /1e6 divide that formatUnits does
    // internally. The MM-1 fix is the BigInt accumulator (`tvlWei +=
    // BigInt(m.collateralValueWei)`) rather than a Number sum — the
    // Number sum WOULD lose precision at the micro-USDC scale.
    const a = (5_000_000_000_000_000n).toString(); // 5e15 micro-USDC = $5B
    const b = (5_000_000_000_000_000n).toString();
    (gql as any).mockResolvedValue({
      marginAccounts: [{ collateralValueWei: a }, { collateralValueWei: b }],
      positions: [],
    });
    (loadDeploymentRegistry as any).mockResolvedValue({ contracts: {} });

    const json = await (await GET()).json();
    // Exact BigInt sum = 10_000_000_000_000_000 micro-USDC = $10B.
    // formatUsd output: "$10,000,000,000.00" with locale separators.
    expect(json.testnetTvlUsd).toBe('$10,000,000,000.00');
  });

  it('counts VENUES whose adapter contract is in the registry (U-28)', async () => {
    // Audit U-28: pre-fix the counter iterated a hardcoded slug list and
    // returned the number of UNIQUE adapter contracts. Now it iterates
    // VENUES and counts each venue whose adapterSlug has a registered
    // contract — HIP-3 and HIP-4 both count when adapter-hyperliquid
    // lands (they share the contract via Venue.adapterSlug).
    (gql as any).mockResolvedValue({
      marginAccounts: [],
      positions: [],
    });
    (loadDeploymentRegistry as any).mockResolvedValue({
      contracts: {
        'adapter-curve': { address: '0x' + '1'.repeat(40) },
        'adapter-pendle': { address: '0x' + '2'.repeat(40) },
        'adapter-hyperliquid': { address: '0x0000000000000000000000000000000000000000' },
        // The zero-address adapter is treated as "deployed" because the
        // registry-only lens checks for `.address` presence. Same
        // canonical behavior as pre-U-28.
      },
    });

    const json = await (await GET()).json();
    // adapter-curve → curve venue (1)
    // adapter-pendle → pendle-v2 venue (1)
    // adapter-hyperliquid → hyperliquid (HIP-3) + hl-hip4 venues (2)
    // Total: 4 of 7 venues have a deployed adapter.
    expect(json.venuesDeployed.count).toBe(4);
    expect(json.venuesDeployed.total).toBe(VENUE_COUNT);
  });
});

describe('GET /api/protocol/metrics — Scribe outage (iter 39)', () => {
  it('returns venuesDeployed.count:null on gql failure per iter-39', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe 503'));

    const json = await (await GET()).json();
    // The load-bearing iter-39 fix: error-path count is null, NOT 0.
    // Pre-fix the landing rendered "0 / 7 deployed" during a Scribe
    // outage, falsely advertising the catastrophic state of zero
    // venues. Null = honest unknown.
    expect(json.venuesDeployed).toEqual({ count: null, total: VENUE_COUNT });
  });

  it('returns source:pending on gql failure', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe timeout'));

    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });

  it('returns all numeric fields as null on gql failure', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe 503'));

    const json = await (await GET()).json();
    expect(json.testnetTvlUsd).toBeNull();
    expect(json.testnetTvlDelta30d).toBeNull();
    expect(json.registeredAgents).toBeNull();
    expect(json.agentsWithOpenPositions).toBeNull();
    expect(json.codex24hQueries).toBeNull();
  });
});
