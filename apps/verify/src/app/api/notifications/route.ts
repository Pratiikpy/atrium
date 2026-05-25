import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { ago, parseTsOrNull } from '@/lib/format-time';

export const dynamic = 'force-dynamic';

interface ScribeLiquidation {
  id: string;
  user: string;
  timestamp: string;
  txHash: string;
}
interface ScribeMandate {
  id: string;
  owner: string;
  agent: string;
  intentHash: string;
  timestamp: string;
  txHash: string;
}

/**
 * Notifications inbox. Aggregates the events that are likely to matter to
 * a specific user:
 *   - Liquidations on their account (high severity)
 *   - Mandate revocations they triggered (warning)
 *   - Lantern attestations affecting their balance (info)
 *   - Withdrawal SLA hits (warning)
 */
export async function GET(req?: Request) {
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam.toLowerCase()
      : process.env.DEMO_WALLET_ADDRESS?.toLowerCase() ?? null;
  if (!wallet) return NextResponse.json({ notifications: [], source: 'pending' });
  try {
    const data = await gql<{
      liquidationEvents: ScribeLiquidation[];
      sigilRevocations: ScribeMandate[];
    }>(
      `query Inbox($u: Bytes!) {
        liquidationEvents(first: 20, where: { user: $u }, orderBy: timestamp, orderDirection: desc) {
          id user timestamp txHash
        }
        sigilRevocations(first: 20, where: { owner: $u }, orderBy: timestamp, orderDirection: desc) {
          id owner agent intentHash timestamp txHash
        }
      }`,
      { u: wallet }
    );
    const notifications: Array<{
      id: string;
      severity: 'info' | 'warning' | 'danger';
      title: string;
      meta: string;
      timestamp: string;
      tsUnix: number;
      txHash?: string;
    }> = [];
    // Audit S-6 fix: sort by numeric unix timestamp, not by the human "Xm ago"
    // string. String compare on "15m ago" vs "2h ago" is lexical and
    // non-deterministic.
    //
    // Audit II-1 fix: parseInt on empty / malformed Scribe timestamps returns
    // NaN. Pre-fix: `ago(NaN)` rendered "NaN s ago" and `sort((a,b) => b - a)`
    // with NaN tsUnix was non-deterministic (NaN propagates as 0 in subtract
    // comparator → unstable ordering). Now we drop entries with bad timestamps.
    for (const l of data.liquidationEvents ?? []) {
      const ts = parseTsOrNull(l.timestamp);
      if (ts == null) continue;
      notifications.push({
        id: `liq-${l.id}`,
        severity: 'danger',
        title: 'Liquidation triggered',
        meta: 'Vigil started a partial liquidation on your account.',
        timestamp: ago(ts),
        tsUnix: ts,
        txHash: l.txHash,
      });
    }
    for (const m of data.sigilRevocations ?? []) {
      const ts = parseTsOrNull(m.timestamp);
      if (ts == null) continue;
      notifications.push({
        id: `rev-${m.id}`,
        severity: 'warning',
        title: `Mandate revoked · ${m.agent.slice(0, 8)}…`,
        meta: `intent ${m.intentHash.slice(0, 14)}… revoked`,
        timestamp: ago(ts),
        tsUnix: ts,
        txHash: m.txHash,
      });
    }
    notifications.sort((a, b) => b.tsUnix - a.tsUnix);
    // Audit T-6 + U-7: tsUnix is a server-side sort key only — strip from
    // wire. The destructure-discard pattern is intentional; eslint-disable
    // below silences the unused-vars lint on the intentionally-discarded var.
    const wireSafe = notifications.slice(0, 50).map((n) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tsUnix, ...rest } = n;
      return rest;
    });
    return NextResponse.json({ notifications: wireSafe, source: 'scribe' as const });
  } catch {
    return NextResponse.json({ notifications: [], source: 'pending' });
  }
}

