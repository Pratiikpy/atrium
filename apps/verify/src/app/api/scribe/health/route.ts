import { NextResponse } from 'next/server';
import { checkScribeHealth } from '@/lib/scribe-health';

export const dynamic = 'force-dynamic';

/**
 * GET /api/scribe/health
 *
 * Returns Scribe indexer health: indexed block, chain head, lag, staleness.
 * Used by the app-shell banner (Phase 5) to warn users when data is stale.
 */
export async function GET() {
  const scribeUrl = process.env.SCRIBE_URL;
  if (!scribeUrl) {
    return NextResponse.json({ error: 'SCRIBE_URL not configured' }, { status: 503 });
  }
  try {
    const health = await checkScribeHealth(scribeUrl);
    return NextResponse.json(health);
  } catch {
    return NextResponse.json({ error: 'health_check_failed' }, { status: 503 });
  }
}
