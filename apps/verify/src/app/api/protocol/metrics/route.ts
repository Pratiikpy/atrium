import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { VENUES, VENUE_COUNT } from '@/lib/venues';
import { loadDeploymentRegistry } from '@/lib/deployments-registry';
import { formatUsd } from '@/lib/format-usd';

export const dynamic = 'force-dynamic';

const USDC_DECIMALS = 6;

/**
 * Protocol-wide metrics for the landing "numbers" section. Reads from
 * Scribe; honest empty state until contracts deploy.
 */
export async function GET() {
  try {
    // Iteration 36 audit note: `first: 1000` is The Graph's default page
    // cap. For testnet (target hundreds of users) the cap is comfortable.
    // Beyond ~1000 margin accounts the TVL would silently undercount —
    // the same shape of silent-failure the rest of this session has been
    // hunting. Tracked as a known scaling gap; the right fix at that
    // point is pagination via `skip`, or a Counter @entity in the subgraph
    // (already TODO'd in indexing-todo.md). Leaving the cap because adding
    // pagination today is over-scope for the current user count.
    const data = await gql<{
      marginAccounts: Array<{ collateralValueWei: string }>;
      positions: Array<{ id: string }>;
    }>(`
      query Metrics {
        marginAccounts(first: 1000) { collateralValueWei }
        positions(first: 1000, where: { closedAtBlock: null }) { id }
      }
    `);

    let tvlWei = 0n;
    for (const m of data.marginAccounts ?? []) tvlWei += BigInt(m.collateralValueWei);

    const venuesDeployed = await countDeployedAdapters();

    // Audit MM-1 fix: aggregated TVL across all margin accounts can exceed
    // Number.MAX_SAFE_INTEGER in micro-USDC. formatUsd preserves precision.
    //
    // Iteration 35 audit fix: the field was previously named `venuesLive`
    // and consumers rendered it as "Live venues N/7." But the count was
    // measured from the deployment registry — adapters with a non-zero
    // contract address — NOT from on-chain `get_venue_health()` reads. A
    // deployed-but-broken adapter (depegged oracle, paused, rate-limited)
    // would show as "live" alongside a healthy one. Renamed to
    // `venuesDeployed` so the field name matches what the count actually
    // measures. A separate `venuesOperational` field (RPC-driven, cached)
    // is appropriate when bandwidth budget allows; until then the UI
    // labels the tile "Deployed venues" so users aren't misled.
    return NextResponse.json({
      testnetTvlUsd: tvlWei > 0n ? formatUsd(tvlWei, USDC_DECIMALS) : null,
      testnetTvlDelta30d: null,
      // Iteration 36 audit fix: these were hardcoded to 0 in the success
      // path, NOT measured from any data source. The UI rendered them as
      // "Registered agents 0" — looks identical to a real measured zero.
      // Same label-lie shape as iteration 35's venuesLive: the field name
      // implied a measurement the code wasn't making.
      //
      // Now: null = "we don't have a source for this yet." The consumer
      // (numbers-section.tsx) already has a fallback sub-label ("erc-8004
      // registry pending") for the null case. The real wiring needs an
      // Agent-registry subgraph entity (planned, indexing-todo.md tier-3
      // Rostrum-adjacent). Until then, honest pending beats fake zero.
      registeredAgents: null,
      agentsWithOpenPositions: null,
      codex24hQueries: null,
      venuesDeployed: { count: venuesDeployed, total: VENUE_COUNT },
      source: 'scribe' as const,
    });
  } catch {
    return NextResponse.json({
      testnetTvlUsd: null,
      testnetTvlDelta30d: null,
      registeredAgents: null,
      agentsWithOpenPositions: null,
      codex24hQueries: null,
      // Iteration 39: pre-fix `count: 0` here would render "0 / 7
      // deployed" on the landing page during a Scribe outage. Same
      // fake-zero shape as the registeredAgents bug in iter 36. Null =
      // unknown. Consumers using `count ?? 0` for arithmetic still get
      // 0, but consumers that render "X / Y" can branch on null to show
      // an em-dash instead.
      venuesDeployed: { count: null, total: VENUE_COUNT },
      source: 'pending',
    });
  }
}

async function countDeployedAdapters(): Promise<number> {
  // Wave-II refactor: registry path-walk lives in lib/deployments-registry.ts.
  // Counts adapters with a non-zero contract address in the deployments
  // registry. This is "deployed" — present on chain at a known address. It
  // is NOT "operational" — the adapter may be deployed but paused, oracle-
  // depegged, or otherwise unable to route. A separate read of each
  // adapter's `get_venue_health()` via RPC is needed for operational
  // status; not done here to keep the metrics endpoint at a single-source-
  // of-truth cost (registry file read, no RPC fanout).
  //
  // Audit U-28: pre-fix the slug list was hardcoded ['aave-horizon',
  // 'hyperliquid', 'pendle', 'curve', 'trade-xyz', 'polymarket'] — adding
  // a new venue to @/lib/venues silently failed to update the count.
  // Now we count VENUES whose adapter contract is in the registry — a
  // venue is "deployed" when its adapter slug has a non-zero address.
  // HIP-3 and HIP-4 both count when adapter-hyperliquid lands because
  // they share that contract. Total matches VENUE_COUNT for symmetry
  // with the landing-page "X / 7" label.
  const reg = await loadDeploymentRegistry();
  if (!reg?.contracts) return 0;
  const contracts = reg.contracts;
  return VENUES.filter((v) => contracts[`adapter-${v.adapterSlug}`]?.address).length;
}
