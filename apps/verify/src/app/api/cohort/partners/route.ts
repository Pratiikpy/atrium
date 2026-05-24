import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await gql<{ cohortPartners: Array<{ id: string; displayName: string | null }> }>(`
      query Partners {
        cohortPartners(first: 50, orderBy: joinedAtTimestamp, orderDirection: asc) {
          id
          displayName
        }
      }
    `);
    return NextResponse.json({
      partners: (data.cohortPartners ?? []).map((p) => ({ id: p.id, name: p.displayName ?? p.id.slice(0, 10) })),
      source: 'scribe' as const,
    });
  } catch {
    return NextResponse.json({ partners: [], source: 'pending' });
  }
}
