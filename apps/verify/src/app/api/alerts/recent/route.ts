import { NextRequest, NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { safeErrorDetail } from '@/lib/safe-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/alerts/recent
 *
 * Surfaces the verify-app ops alert timeline. Queries the unified `AlertEvent`
 * entity (added 2026-05-19 indexing iteration 12) which captures 5 Tier-1
 * events across 4 contracts:
 *
 *   - oracle_disagreement              (Plinth)
 *   - vigil_queue_failed               (Plinth)
 *   - link_balance_low                 (Aqueduct)
 *   - usdc_paused                      (Coffer)
 *   - adapter_emergency_deregistered   (PorticoRegistry)
 *
 * The dashboard uses this for the "ops timeline" panel; PagerDuty / Discord
 * webhook plumbing also drives off this single source rather than polling
 * each contract individually.
 *
 * Query params:
 *   ?limit=50   — max 100, default 25
 *   ?kind=...   — optional filter to a single alert kind (closed-enum below)
 *   ?since=...  — unix-seconds timestamp; only return alerts newer than this
 */
const VALID_KINDS = new Set([
  'oracle_disagreement',
  'vigil_queue_failed',
  'link_balance_low',
  'usdc_paused',
  'adapter_emergency_deregistered',
  'emergency_pause_invoked',
]);

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

function parseUintOrNull(s: string | null): number | null {
  if (s == null || !/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

interface AlertWire {
  id: string;
  kind: string;
  contract: string;
  blockNumber: string;
  timestamp: string;
  // Tier-1 kind-specific fields; all optional.
  chainlinkPriceQ64: string | null;
  pythPriceQ64: string | null;
  toleranceBps: number | null;
  user: string | null;
  marginVersion: string | null;
  linkBalanceWei: string | null;
  link30dUsageWei: string | null;
  venueId: number | null;
  adapter: string | null;
  reason: string | null;
}

export async function GET(req: NextRequest) {
  const limitRaw = parseUintOrNull(req.nextUrl.searchParams.get('limit'));
  const limit = Math.min(limitRaw ?? DEFAULT_LIMIT, MAX_LIMIT);

  const kindRaw = req.nextUrl.searchParams.get('kind');
  if (kindRaw != null && !VALID_KINDS.has(kindRaw)) {
    return NextResponse.json(
      { error: 'invalid_kind', detail: `kind must be one of: ${Array.from(VALID_KINDS).join(', ')}` },
      { status: 400 },
    );
  }

  const sinceRaw = parseUintOrNull(req.nextUrl.searchParams.get('since'));
  const since = sinceRaw != null ? sinceRaw.toString() : '0';

  // Build the where clause inline. Closed-enum kind + numeric since are both
  // safe to interpolate via GraphQL variables.
  const where: Record<string, string> = { timestamp_gt: since };
  if (kindRaw != null) where.kind = kindRaw;

  const query = `
    query Alerts($limit: Int!, $where: AlertEvent_filter) {
      alertEvents(
        first: $limit,
        orderBy: timestamp,
        orderDirection: desc,
        where: $where
      ) {
        id
        kind
        contract
        blockNumber
        timestamp
        chainlinkPriceQ64
        pythPriceQ64
        toleranceBps
        user
        marginVersion
        linkBalanceWei
        link30dUsageWei
        venueId
        adapter
        reason
      }
    }
  `;

  try {
    const data = await gql<{ alertEvents: AlertWire[] }>(query, { limit, where });
    return NextResponse.json({
      alerts: data.alertEvents,
      count: data.alertEvents.length,
      source: 'scribe' as const,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'scribe_unavailable', detail: safeErrorDetail(err) },
      { status: 503 },
    );
  }
}
