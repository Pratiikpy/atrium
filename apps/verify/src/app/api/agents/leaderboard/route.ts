import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';

export const dynamic = 'force-dynamic';

/**
 * Rostrum leaderboard.
 *
 * Audit VV-3 fix (eta.0): the prior version mapped sigil validation
 * counts onto a "copiers" column, silently substituting "agent actions"
 * for "users following this agent" (UU-10 family).
 *
 * Phase theta.3 status (2026-05-25): the subgraph now indexes
 * RostrumReputation + RostrumMirrorTrade (Phase η.1) and the data is
 * available to query. The leaderboard.tsx component, however, still
 * expects prototype-era fields (pnl7dBps, sharpe, aumUsd, sparkline7d,
 * copiers) that the on-chain Rostrum events do not carry. Shipping a
 * real Rostrum-shaped payload through the route alone would crash the
 * component on undefined fields.
 *
 * The honest path forward is a paired commit (component + route +
 * tests) that maps real Rostrum metrics onto a new component prop
 * shape, tracked in human_left.md `rostrum-leaderboard-wiring`. Until
 * that ships the route returns the existing pending shape so the
 * component renders the empty state honestly. A health-check gql probe
 * against `rostrumReputations` confirms the data source is reachable
 * (used by readiness checks); the data is discarded for the response.
 */
export async function GET() {
  let probeOk = false;
  let probeRows = 0;
  try {
    const data = await gql<{ rostrumReputations: Array<{ id: string }> }>(`
      query LeaderboardProbe {
        rostrumReputations(first: 1, orderBy: currentScore, orderDirection: desc) { id }
      }
    `);
    probeOk = true;
    probeRows = data.rostrumReputations?.length ?? 0;
  } catch {
    // Probe failure → still return pending, never invent rows.
  }

  return NextResponse.json({
    agents: [],
    source: 'pending' as const,
    detail: probeOk
      ? `Rostrum subgraph reachable (${probeRows} reputation row(s) indexed). Leaderboard component still on prototype field shape, paired refactor pending per human_left.md \`rostrum-leaderboard-wiring\`.`
      : 'Rostrum subgraph probe failed. Retrying on next refresh.',
  });
}
