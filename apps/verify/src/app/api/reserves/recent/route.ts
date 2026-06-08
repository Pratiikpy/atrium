import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { parseTsOrNull } from '@/lib/format-time';

export const dynamic = 'force-dynamic';

// Audit U-11 fix: previously this route always returned the top 24 rows,
// while the UI surfaced "24h / 7d / 30d" tabs as if they filtered the
// data. They didn't, the tabs were dead `<span>` elements with no
// handlers. The window param lets the client choose how many hourly
// attestation rows to fetch, so the tabs can drive real queries.
// Lantern publishes hourly so 24/168/720 rows ≈ 24h/7d/30d.
// Audit follow-up (2026-06-08 mobile QA): these were ROW limits with the
// assumption "Lantern publishes hourly so 24 rows ~= 24h". The self-loop
// publishes irregularly (~45min when looping, gaps on cron restarts), so 24
// rows actually spanned ~2 days - the "Last 24h" list rendered 2-day-old rows.
// Fix: fetch a generous row cap THEN filter by real timestamp below, so "24h"
// means the last 24 hours of wall-clock, not the last 24 attestations. Caps are
// sized to cover the window even at a dense ~15min cadence (subgraph first: max
// is 1000).
const WINDOW_TO_LIMIT: Record<string, number> = {
  '24h': 120,
  '7d': 700,
  '30d': 1000,
};
const WINDOW_TO_SECONDS: Record<string, number> = {
  '24h': 86_400,
  '7d': 604_800,
  '30d': 2_592_000,
};

/**
 * Strict-numeric parse for Scribe BigInt-as-string fields (blockNumber,
 * leafCount, etc.). Returns null on `parseInt('NaN')` etc. so we drop
 * corrupt rows rather than rendering NaN to the UI.
 */
function parseIntOrNull(s: string | null | undefined): number | null {
  if (s == null || s === '') return null;
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

// Next's route-handler typegen requires the first arg to be the exact
// `Request | NextRequest` shape. Making it optional broke the typegen.
// Tests now construct a default Request when they don't need to set
// the window param.
export async function GET(req: Request) {
  const windowKey = new URL(req.url).searchParams.get('window') ?? '24h';
  const limit = WINDOW_TO_LIMIT[windowKey] ?? 120;
  // Real wall-clock cutoff so the window label is accurate (see the note on
  // WINDOW_TO_LIMIT). force-dynamic above keeps this evaluated per request.
  const windowSeconds = WINDOW_TO_SECONDS[windowKey] ?? 86_400;
  const cutoffSeconds = Math.floor(Date.now() / 1000) - windowSeconds;
  try {
    const data = await gql<{
      lanternAttestations: Array<{ root: string; blockNumber: string; timestamp: string; leafCount: string; ipfsCid: string }>;
    }>(
      `query Recent($limit: Int!) {
        lanternAttestations(first: $limit, orderBy: blockNumber, orderDirection: desc) {
          root
          blockNumber
          timestamp
          leafCount
          ipfsCid
        }
      }`,
      { limit },
    );
    // Audit MM-2 fix: prior code did `parseInt(...)` on three Scribe fields
    // without validation. On malformed values (real during subgraph reorgs):
    //   - blockNumber → NaN → UI renders "NaN"
    //   - leafCount → NaN
    //   - timestamp → NaN * 1000 → `new Date(NaN).toLocaleString()` returns
    //     the literal string "Invalid Date"
    // Now we drop rows with any invalid field rather than rendering corrupt UI.
    const attestations: Array<{
      id: string;
      blockNumber: number;
      rootHash: string;
      leafCount: number;
      pinned: boolean;
      attestationTime: string;
      status: 'PASS' | 'PENDING';
    }> = [];
    for (const a of data.lanternAttestations ?? []) {
      const block = parseIntOrNull(a.blockNumber);
      const leaves = parseIntOrNull(a.leafCount);
      const ts = parseTsOrNull(a.timestamp);
      if (block == null || leaves == null || ts == null) continue;
      // Drop rows older than the requested window (ts is unix seconds). This is
      // what makes "Last 24h" mean 24 hours rather than 24 rows.
      if (ts < cutoffSeconds) continue;
      // Launch-review P0 (fake-as-live): this used to hardcode pinned:true +
      // status:'PASS' on EVERY row, claiming end-to-end-verifiable proof of
      // reserves even when the Merkle tree was never pinned to IPFS (so a user
      // CANNOT verify their own inclusion). Derive both from the indexed
      // ipfsCid, matching /api/lantern/latest's ipfsPinned semantics + its
      // >=10-char CID heuristic: a row is PASS (inclusion-verifiable) only when
      // its tree is pinned; an on-chain-only root is honestly PENDING.
      const pinned = typeof a.ipfsCid === 'string' && a.ipfsCid.length >= 10;
      attestations.push({
        id: a.root,
        blockNumber: block,
        rootHash: a.root,
        leafCount: leaves,
        pinned,
        attestationTime: new Date(ts * 1000).toLocaleString(),
        status: pinned ? 'PASS' : 'PENDING',
      });
    }
    return NextResponse.json({ attestations, source: 'scribe' as const });
  } catch {
    return NextResponse.json({ attestations: [], source: 'pending' });
  }
}
