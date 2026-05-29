import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { ago, parseTsOrNull } from '@/lib/format-time';
import { formatUsd } from '@/lib/format-usd';
import { tryGetRedeemableAssets } from '@/lib/coffer-source';

export const dynamic = 'force-dynamic';

const USDC_DECIMALS = 6;

// Iteration 34 audit fix: staleness flag for Lantern attestations.
// Pre-fix the route returned `lastAttestedAgo` as a string ("25 hours ago")
// but the UI rendered it next to "every 10 min" with no visual stale state.
// A user reading the dashboard during an attestor outage would see "25
// hours ago" + green tile and read it as fresh; the staleness signal
// was implicit (compare the two strings) when it should be explicit.
//
// Threshold = 2x expected 10-min cadence + 5-minute grace for cron jitter
// and CCIP confirmation depth. This catches a single missed publish AND
// the start of a sustained outage.
const TEN_MIN_CADENCE_SECONDS = 10 * 60;
const STALE_THRESHOLD_SECONDS = 2 * TEN_MIN_CADENCE_SECONDS + 5 * 60;

export async function GET() {
  // Redeemable = Coffer.totalAssets() (underlying USDC backing every share),
  // read independently of Scribe. null when the vault is undeployed or the
  // read reverts (honest pending); "0.00" when deployed and empty (the truth,
  // not pending). This is the "what you can redeem right now" figure, distinct
  // from the net-deposited TVL the subgraph indexes.
  const redeemableWei = await tryGetRedeemableAssets();
  const redeemableUsd = redeemableWei != null ? formatUsd(redeemableWei, USDC_DECIMALS) : null;

  try {
    const data = await gql<{
      counter: { totalTvlWei: string } | null;
      lanternAttestations: Array<{ timestamp: string; leafCount: string }>;
    }>(`
      query Summary {
        counter(id: "global") { totalTvlWei }
        lanternAttestations(first: 1, orderBy: blockNumber, orderDirection: desc) { timestamp leafCount }
      }
    `);
    const tvl = data.counter ? BigInt(data.counter.totalTvlWei) : 0n;
    // Audit KK-13 fix: formatUsd preserves precision past safe-int + handles
    // sub-cent values honestly. Prior `Number(tvl) / 1e6` lost precision
    // on aggregated balances above ~$9 quadrillion micro-USDC.
    const tvlUsd = tvl > 0n ? formatUsd(tvl, USDC_DECIMALS) : null;
    const last = data.lanternAttestations?.[0];
    // Audit KK-14 fix: parseTsOrNull rejects malformed Scribe timestamps
    // before they reach ago(), which would otherwise render "NaN s ago".
    const lastTs = last ? parseTsOrNull(last.timestamp) : null;
    const lastAgo = lastTs != null ? ago(lastTs) : 'pending';
    const leafCount = last && /^\d+$/.test(last.leafCount) ? parseInt(last.leafCount, 10) : null;

    // Compute isStale at the server boundary, not the client. Clock-skew
    // between server + user-browser is the only argument for client-side
    // computation, and that's a tiny effect compared to the hour-scale
    // threshold. Server-side keeps the boolean a single source of truth
    // for any future API consumers.
    const nowSec = Math.floor(Date.now() / 1000);
    const ageSec = lastTs != null ? nowSec - lastTs : null;
    const isStale = ageSec == null ? true : ageSec > STALE_THRESHOLD_SECONDS;
    const staleReason = lastTs == null
      ? 'no attestation indexed yet'
      : isStale
      ? `${Math.round((ageSec ?? 0) / 60)} min since last publish; threshold ${Math.round(STALE_THRESHOLD_SECONDS / 60)} min`
      : null;

    return NextResponse.json({
      tvlUsd,
      redeemableUsd,
      lastAttestedTvlUsd: tvlUsd,
      lastAttestedAgo: lastAgo,
      leafCount,
      isStale,
      staleReason,
      staleThresholdMin: Math.round(STALE_THRESHOLD_SECONDS / 60),
      source: 'scribe' as const,
    });
  } catch {
    // Scribe failure → treat as stale. Consumer rendering should fall back
    // to the "stale" visual rather than the "fresh" one, since unknown
    // truth is closer to stale than fresh per the honesty contract.
    return NextResponse.json({
      tvlUsd: null,
      // redeemableUsd is independent of Scribe (direct Coffer read), so it can
      // still be present even when the subgraph is down.
      redeemableUsd,
      lastAttestedTvlUsd: null,
      lastAttestedAgo: 'pending',
      leafCount: null,
      isStale: true,
      staleReason: 'Scribe unavailable; freshness unknown',
      staleThresholdMin: Math.round(STALE_THRESHOLD_SECONDS / 60),
      source: 'pending',
    });
  }
}

