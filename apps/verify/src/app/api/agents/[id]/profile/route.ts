import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/[id]/profile
 *
 * Per-agent profile data for /agents/marketplace/[id]. Reads Rostrum
 * (reputation + deboost) + Sigil (mandate actions) from Scribe. Honest
 * pending when the subgraph has no rows yet (no fake zeros).
 *
 * Phase eta.7 (2026-05-25): lands the trust-signal data path that the
 * AgentProfileLive client component reads.
 */
interface Profile {
  id: string;
  totalActions: number | null;
  successfulActions: number | null;
  revertedActions: number | null;
  reputationTier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'deboosted' | null;
  deboostEvents: Array<{ at: number; reason: string }>;
  pnl: {
    d7Pct: number | null;
    d30Pct: number | null;
    d90Pct: number | null;
    maxDrawdownPct: number | null;
  };
  source: 'scribe' | 'pending';
}

function emptyProfile(id: string, source: Profile['source']): Profile {
  return {
    id,
    totalActions: null,
    successfulActions: null,
    revertedActions: null,
    reputationTier: null,
    deboostEvents: [],
    pnl: { d7Pct: null, d30Pct: null, d90Pct: null, maxDrawdownPct: null },
    source,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  try {
    // Rostrum reputation entity is keyed by agent address; the marketplace
    // currently uses string slugs (augur/haruspex/auspex). When the
    // reference agents are deployed to Sepolia + register on Rostrum,
    // their addresses will land in the deployments registry and this
    // query swaps to address-keyed lookup. Until then, honest pending.
    const data = await gql<{
      rostrumReputation: { tier: string; deboostHistory: string } | null;
      rostrumLeaderDeboosts: Array<{ at: string; reason: string }>;
      rostrumMirrorTrades: Array<{ realisedPnlSigned: string; at: string }>;
      rostrumAgentActions: Array<{ kind: string; at: string }>;
    }>(
      `query AgentProfile($id: String!) {
        rostrumReputation(id: $id) { tier deboostHistory }
        rostrumLeaderDeboosts(where: { leader: $id }, orderBy: at, orderDirection: desc, first: 10) {
          at
          reason
        }
        rostrumMirrorTrades(where: { leader: $id }, orderBy: at, orderDirection: desc, first: 1000) {
          realisedPnlSigned
          at
        }
        rostrumAgentActions(where: { agent: $id }, orderBy: at, orderDirection: desc, first: 1000) {
          kind
          at
        }
      }`,
      { id },
    );

    const actions = data.rostrumAgentActions ?? [];
    const successful = actions.filter((a) => a.kind !== 'REVERTED').length;
    const reverted = actions.filter((a) => a.kind === 'REVERTED').length;
    const totalActions = actions.length;

    const tier = data.rostrumReputation?.tier ?? null;
    const deboostEvents = (data.rostrumLeaderDeboosts ?? []).map((d) => ({
      at: Number(d.at),
      reason: d.reason,
    }));

    // PnL windows: sum signed pnl from mirror trades within each window.
    const now = Math.floor(Date.now() / 1000);
    const d7  = now - 7 * 86400;
    const d30 = now - 30 * 86400;
    const d90 = now - 90 * 86400;
    const trades = data.rostrumMirrorTrades ?? [];
    const sumWindow = (cutoff: number) =>
      trades
        .filter((t) => Number(t.at) >= cutoff)
        .reduce((acc, t) => acc + Number(t.realisedPnlSigned), 0);
    // Without a notional/capital denominator on the trade rows, percentage
    // can only be computed relative to a baseline mandate cap. That baseline
    // is per-mandate and not stored on the trade. Defer percentage with
    // honest null until the mandate-cap join lands; sum-USD would be
    // misleading without disclosure.
    return NextResponse.json<Profile>({
      id,
      totalActions: totalActions > 0 ? totalActions : null,
      successfulActions: totalActions > 0 ? successful : null,
      revertedActions: totalActions > 0 ? reverted : null,
      reputationTier: (tier as Profile['reputationTier']) ?? null,
      deboostEvents,
      pnl: {
        d7Pct: null,
        d30Pct: null,
        d90Pct: null,
        maxDrawdownPct: null,
      },
      source: totalActions > 0 || deboostEvents.length > 0 ? 'scribe' : 'pending',
    });
  } catch {
    return NextResponse.json(emptyProfile(id, 'pending'));
  }
}
