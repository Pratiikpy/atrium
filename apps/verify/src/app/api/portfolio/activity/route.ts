import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { ago, parseTsOrNull } from '@/lib/format-time';
import { requireWalletMatch } from '@/lib/auth-session';
import { noCacheHeaders } from '@/lib/no-cache-headers';

export const dynamic = 'force-dynamic';

export async function GET(req?: Request) {
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  // Phase 2c: lock to authenticated session
  if (req && wallet) {
    const denied = await requireWalletMatch(req, wallet);
    if (denied) return denied;
  }
  if (!wallet) {
    return NextResponse.json({ activities: [], source: 'pending' });
  }
  try {
    // Combine the most recent margin updates + position events + Sigil
    // validations into one chronological feed.
    const data = await gql<{
      marginUpdates: Array<{ blockNumber: string; timestamp: string }>;
      positions: Array<{ id: string; venueId: number; openedAtBlock: string; openedAtTimestamp: string }>;
      sigilValidations: Array<{ intentHash: string; agent: string | null; timestamp: string; txHash: string }>;
    }>(
      `query Activity($u: Bytes!) {
        marginUpdates(first: 5, where: { account: $u }, orderBy: blockNumber, orderDirection: desc) {
          blockNumber
          timestamp
        }
        positions(first: 5, where: { owner: $u }, orderBy: openedAtBlock, orderDirection: desc) {
          id
          venueId
          openedAtBlock
          openedAtTimestamp
        }
        sigilValidations(first: 5, where: { owner: $u }, orderBy: timestamp, orderDirection: desc) {
          intentHash
          agent
          timestamp
          txHash
        }
      }`,
      { u: wallet.toLowerCase() }
    );

    // Audit KK-8 fix: prior code sorted by the human "Xm ago" string,
    // which is lexical and non-deterministic ("10m ago" < "2m ago"
    // alphabetically). Same as the audit S-6 fix that landed in
    // notifications/route.ts — the bug crept back here because the
    // activity feed was written without referencing that fix.
    //
    // Audit KK-9 + KK-10: drop events with corrupt timestamps or null
    // agent fields rather than rendering "NaN s ago" or throwing on
    // `.slice()` of null.
    interface Activity {
      id: string;
      kind: string;
      title: string;
      meta: string;
      timestamp: string;
      tsUnix: number; // sort key — stripped before wire
      txHash?: string;
    }
    const activities: Activity[] = [];

    for (const m of data.marginUpdates ?? []) {
      const ts = parseTsOrNull(m.timestamp);
      if (ts == null) continue;
      activities.push({
        id: `margin-${m.blockNumber}`,
        kind: 'tx',
        title: 'Margin recomputed',
        meta: `Block ${m.blockNumber}`,
        timestamp: ago(ts),
        tsUnix: ts,
      });
    }
    for (const p of data.positions ?? []) {
      const ts = parseTsOrNull(p.openedAtTimestamp);
      if (ts == null) continue;
      activities.push({
        id: `pos-${p.id}`,
        kind: 'tx',
        title: 'Position opened',
        meta: `Venue ${p.venueId}`,
        timestamp: ago(ts),
        tsUnix: ts,
      });
    }
    for (const v of data.sigilValidations ?? []) {
      const ts = parseTsOrNull(v.timestamp);
      if (ts == null) continue;
      if (typeof v.agent !== 'string') continue;
      activities.push({
        id: `sigil-${v.intentHash}`,
        kind: 'mandate',
        title: 'Sigil validated',
        meta: `Agent ${v.agent.slice(0, 8)}…`,
        timestamp: ago(ts),
        tsUnix: ts,
        txHash: v.txHash,
      });
    }

    activities.sort((a, b) => b.tsUnix - a.tsUnix);
    const wireSafe = activities.slice(0, 12).map((a) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tsUnix: _tsUnix, ...rest } = a;
      return rest;
    });
    return NextResponse.json({ activities: wireSafe, source: 'scribe' as const }, { headers: noCacheHeaders });
  } catch {
    return NextResponse.json({ activities: [], source: 'pending' });
  }
}
