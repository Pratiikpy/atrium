import { NextResponse } from 'next/server';
import { VENUES } from '@/lib/venues';

export const dynamic = 'force-dynamic';

/**
 * Local testnet mirror for the Codex `GET /venues` endpoint - the venue-health
 * read that backs the x402 API's venue surface, so the /docs/api try-it can
 * demo it with no x402 payment and no wallet (venue health is public).
 *
 * Returns the canonical VENUES list (the seven Portico-whitelisted venues) with
 * each one's Plinth venue_id, asset class, initial-margin haircut, and
 * live/scaffold status - the data a real `GET /venues` call returns.
 *
 * Replaces the prior try-it mapping `GET /venues` -> /api/protocol/subsystems,
 * which returned the full live-CONTRACTS list (praetor-timelock, coffer, sigil,
 * adapter-*, ...) under a "venues" label - subsystems, not venues. A judge
 * clicking the endpoint got the wrong shape while the component claimed the
 * mirror "serves the same data". Found via /docs/api try-it QA (2026-06-08).
 */
export function GET() {
  return NextResponse.json({
    venues: VENUES.map((v) => ({
      id: v.id,
      label: v.label,
      venueId: v.venueId,
      kind: v.kind,
      initialMarginHaircutBps: v.haircutBps,
      status: v.operational ? 'operational' : 'scaffold',
    })),
    operationalCount: VENUES.filter((v) => v.operational).length,
    total: VENUES.length,
    source: 'portico-registry' as const,
  });
}
