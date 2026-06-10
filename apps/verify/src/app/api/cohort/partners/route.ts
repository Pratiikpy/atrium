import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';

export const dynamic = 'force-dynamic';

type PartnerRow = {
  id: string;
  displayName: string | null;
  joinedAtTimestamp: string | null;
  totalDepositsWei: string | null;
  totalTradesCount: string | null;
  lastActionTimestamp: string | null;
};

export async function GET() {
  try {
    const data = await gql<{ cohortPartners: PartnerRow[] }>(`
      query Partners {
        cohortPartners(first: 50, orderBy: joinedAtTimestamp, orderDirection: asc) {
          id
          displayName
          joinedAtTimestamp
          totalDepositsWei
          totalTradesCount
          lastActionTimestamp
        }
      }
    `);
    return NextResponse.json({
      // `name` stays for existing consumers; the full Scribe row rides along
      // so the cohort grid can read Scribe through this proxy instead of
      // calling the indexer from the browser (server-only SCRIBE_URL).
      partners: (data.cohortPartners ?? []).map((p) => ({
        ...p,
        name: p.displayName ?? p.id.slice(0, 10),
      })),
      source: 'scribe' as const,
    });
  } catch {
    return NextResponse.json({ partners: [], source: 'pending' });
  }
}
