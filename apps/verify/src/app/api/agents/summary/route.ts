import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Audit JJ-6 fix: typed `agent` as nullable so the null-guard pattern is
    // applied uniformly to both arrays. Pre-fix: validations.map called
    // `.toLowerCase()` on a presumed-string and silently threw TypeError when
    // Scribe returned null fields (real during schema rollovers / partial
    // sync). The route's catch then swallowed the throw into the pending
    // fallback — but the data WAS available, just one bad row corrupted the
    // whole response.
    const data = await gql<{
      sigilValidations: Array<{ agent: string | null }>;
      sigilRevocations: Array<{ agent: string | null }>;
    }>(`
      query AgentsSummary {
        sigilValidations(first: 1000) { agent }
        sigilRevocations(first: 1000) { agent }
      }
    `);
    const activeAgents = new Set<string>();
    for (const v of data.sigilValidations ?? []) {
      if (typeof v.agent === 'string') activeAgents.add(v.agent.toLowerCase());
    }
    for (const r of data.sigilRevocations ?? []) {
      if (typeof r.agent === 'string') activeAgents.delete(r.agent.toLowerCase());
    }
    return NextResponse.json({
      activeMandates: activeAgents.size,
      // Audit JJ-7 NOTE: activeSessionKeys is a Postern concept (ERC-7715
      // session keys), distinct from Sigil mandates. Pre-fix conflation:
      // both fields reported the same number (Sigil validations - revocations).
      // The honest fix needs a Postern-side query that doesn't exist in the
      // subgraph schema yet. Until the subgraph schema adds a
      // `posternKeyEvents` aggregation, this field reads null (honest
      // pending) rather than echoing the wrong number.
      activeSessionKeys: null,
      totalCapacityUsd: null,
      capacityUsedPct: null,
      // Iteration 37 audit fix: agentsCopied + feeAgentsCount were
      // hardcoded to 0 in BOTH success and pending paths — never measured
      // against any data source. Audit TTT-1 fixed the client-side stat-row
      // catch (→ nulls) but missed the server route, so the server returned
      // 0 → client passed through → UI rendered "0 agents copied" as if
      // measured. Same partial-coverage shape as iter 18's
      // multisig::execute (audit fix applied to schedule but not execute).
      // Now: null in both paths. UI fallback (stat-row.tsx) already
      // handles null → "—" + "pending" sub-label.
      agentsCopied: null,
      agentsByVenues: null,
      feesPaidUsd: null,
      feeAgentsCount: null,
      source: 'scribe' as const,
    });
  } catch {
    return NextResponse.json({
      // Iteration 37: catch path matches stat-row.tsx's local fallback.
      // Pre-fix had activeMandates:0 which would render "0 active mandates"
      // on any Scribe outage — a user with real mandates would see "0" and
      // might panic-press Kill Switch thinking delegations were revoked.
      activeMandates: null,
      activeSessionKeys: null,
      totalCapacityUsd: null,
      capacityUsedPct: null,
      agentsCopied: null,
      agentsByVenues: null,
      feesPaidUsd: null,
      feeAgentsCount: null,
      source: 'pending',
    });
  }
}
