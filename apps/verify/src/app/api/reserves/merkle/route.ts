import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await gql<{ lanternAttestations: Array<{ leafCount: string; root: string }> }>(`
      query MS { lanternAttestations(first: 1, orderBy: blockNumber, orderDirection: desc) { leafCount root } }
    `);
    const last = data.lanternAttestations?.[0];
    if (!last) return NextResponse.json({ leafCount: null, depth: null, sampleNodes: [], source: 'pending' });
    // Audit MM-3 fix: prior code did `parseInt(last.leafCount, 10)` without
    // validation. On malformed Scribe value, leafCount=NaN propagated through
    // Math.log2 → depth=NaN shipped to UI. Strict-numeric gate before parse.
    if (!/^\d+$/.test(last.leafCount)) {
      return NextResponse.json({ leafCount: null, depth: null, sampleNodes: [], source: 'pending' });
    }
    const leafCount = parseInt(last.leafCount, 10);
    if (!Number.isFinite(leafCount) || leafCount < 0) {
      return NextResponse.json({ leafCount: null, depth: null, sampleNodes: [], source: 'pending' });
    }
    const depth = Math.max(1, Math.ceil(Math.log2(Math.max(leafCount, 1))));
    return NextResponse.json({ leafCount, depth, sampleNodes: [], source: 'scribe' as const });
  } catch {
    return NextResponse.json({ leafCount: null, depth: null, sampleNodes: [], source: 'pending' });
  }
}
