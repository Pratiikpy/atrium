import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { ago, parseTsOrNull } from '@/lib/format-time';
import { formatUsd } from '@/lib/format-usd';
import { tryGetRedeemableAssets } from '@/lib/coffer-source';
import { tryGetLanternAttestationOnchain } from '@/lib/lantern-source';

export const dynamic = 'force-dynamic';

const USDC_DECIMALS = 6;

// Iteration 34 audit fix: staleness flag for Lantern attestations.
// Pre-fix the route returned `lastAttestedAgo` as a string ("25 hours ago")
// but the UI rendered it next to "every 10 min" with no visual stale state.
// A user reading the dashboard during an attestor outage would see "25
// hours ago" + green tile and read it as fresh; the staleness signal
// was implicit (compare the two strings) when it should be explicit.
//
// Threshold = 2x the Lantern publish cadence + grace for cron jitter and CCIP
// confirmation depth. This catches a single missed publish AND the start of a
// sustained outage, without false-positiving between two healthy publishes.
//
// Cadence correction (2026-06-08): the constant was 10 min (the old `*/10` cron),
// giving a 25-min threshold. But the permanent Lantern fix moved publishing to an
// in-run self-loop every 45 min (lantern-cron.yml: `sleep 2700`), because GitHub
// throttles the `cron:` schedule. A 25-min threshold against a 45-min cadence
// flagged the flagship PoR "stale" for ~20 min of EVERY cycle even when the
// attestor was perfectly healthy - a self-inflicted false alarm on the one
// dashboard whose job is to look trustworthy. Align the threshold to the real
// cadence. Found via live QA (api/reserves/summary: 18m ago but threshold 25m).
const LANTERN_PUBLISH_CADENCE_SECONDS = 45 * 60; // mirrors lantern-cron.yml `sleep 2700`
const STALE_THRESHOLD_SECONDS = 2 * LANTERN_PUBLISH_CADENCE_SECONDS + 10 * 60; // 100 min

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
    // Scribe failure → try a DIRECT on-chain LanternAttestor read BEFORE
    // degrading to "pending". The attestation root + block are on-chain (the
    // source of truth Scribe merely indexes), so PoR freshness should survive
    // a subgraph outage. Found via live QA 2026-06-08: a Graph Studio free-tier
    // subgraph outage took the flagship PoR dark for minutes despite a fresh
    // on-chain attestation. tvl/leafCount stay null (they live in the event,
    // not contract storage), exactly as with no fallback - but freshness is
    // recovered from the contract's latest_block + that block's timestamp.
    const onchain = await tryGetLanternAttestationOnchain();
    if (onchain) {
      const nowSec = Math.floor(Date.now() / 1000);
      const ageSec = nowSec - onchain.timestampSec;
      const isStale = ageSec > STALE_THRESHOLD_SECONDS;
      return NextResponse.json({
        tvlUsd: null,
        redeemableUsd,
        lastAttestedTvlUsd: null,
        lastAttestedAgo: ago(onchain.timestampSec),
        leafCount: null,
        isStale,
        staleReason: isStale
          ? `${Math.round(ageSec / 60)} min since last on-chain attestation; threshold ${Math.round(STALE_THRESHOLD_SECONDS / 60)} min (Scribe down; read direct from LanternAttestor)`
          : 'Scribe down; freshness read direct from the on-chain LanternAttestor',
        staleThresholdMin: Math.round(STALE_THRESHOLD_SECONDS / 60),
        source: 'lantern-onchain' as const,
      });
    }
    // Both Scribe AND the on-chain read failed → honest pending. Consumer
    // rendering should fall back to the "stale" visual rather than "fresh",
    // since unknown truth is closer to stale than fresh per the honesty
    // contract. redeemableUsd is independent of Scribe (direct Coffer read),
    // so it can still be present even when both attestation paths are down.
    return NextResponse.json({
      tvlUsd: null,
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

