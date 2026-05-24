import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';

export const dynamic = 'force-dynamic';

/**
 * Rostrum leaderboard.
 *
 * Audit VV-3 fix: prior version sourced `copiers: count` from a Sigil
 * validation count and shipped `source: 'rostrum'`. **Silent semantic
 * substitution** (UU-10 family): a sigil validation is "an agent acting
 * under a mandate" and is conceptually distinct from "users following this
 * agent and mirroring their trades". Two different concepts, one count
 * pretending to be the other.
 *
 * Until Rostrum is in the subgraph (`human_left.md` #26), the leaderboard
 * has no real data source. The route now returns `source: 'pending'`
 * unconditionally with an empty agents array — the dashboard's empty-state
 * UI renders honestly rather than ship a misleading "rostrum" leaderboard
 * built from the wrong entity.
 */
export async function GET() {
  // Until rostrum data source lands in subgraph.yaml (per human_left #26),
  // the only honest leaderboard answer is empty + pending. We KEEP the
  // sigilValidations probe so the route logs a healthy gql connection
  // (used by readiness checks); the data is discarded for the response.
  try {
    await gql<{
      sigilValidations: Array<{ agent: string | null; timestamp: string }>;
    }>(`
      query AgentsLBProbe {
        sigilValidations(first: 1, orderBy: timestamp, orderDirection: desc) { agent timestamp }
      }
    `);
  } catch {
    // Even a probe failure → still return the same pending response.
  }
  return NextResponse.json({
    agents: [],
    source: 'pending' as const,
    detail: 'Rostrum leaderboard pending subgraph indexing — see human_left.md #26.',
  });
}
