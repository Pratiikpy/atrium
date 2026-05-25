import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { venueLabel } from '@/lib/venues';
import { formatUsd, formatShares } from '@/lib/format-usd';

export const dynamic = 'force-dynamic';

const USDC_DECIMALS = 6;

interface ScribePosition {
  id: string;
  venueId: number;
  instrumentId: string;
  notionalSigned: string;
  entryPriceQ64: string;
  closedAtBlock: string | null;
}

export async function GET(req?: Request) {
  // Phase theta audit follow-up: accept ?wallet= per the multi-tenant
  // pattern. See /api/portfolio/buying-power/route.ts for the same shape.
  // `req?` keeps existing vitest GET() callers compatible.
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  if (!wallet) {
    return NextResponse.json({ positions: [], source: 'pending' });
  }
  try {
    const data = await gql<{ positions: ScribePosition[] }>(
      `query Pos($u: Bytes!) {
        positions(where: { owner: $u, closedAtBlock: null }, orderBy: openedAtBlock, orderDirection: desc, first: 50) {
          id
          venueId
          instrumentId
          notionalSigned
          entryPriceQ64
          closedAtBlock
        }
      }`,
      { u: wallet.toLowerCase() }
    );

    // Phase theta audit follow-up (2026-05-25): surface the
    // venue-side position id alongside the Plinth-side id. Pre-fix the
    // route aliased the Plinth id as `venuePositionId` (audit U-21
    // comment acknowledges the conflation); now we read the real venue
    // id from RouterPositionEvent, indexed by plinthPositionId. This
    // unblocks the deferred close-path dual-id-surface noted in
    // use-close-position.ts.
    let venueIdByPlinthId = new Map<string, string>();
    if (data.positions && data.positions.length > 0) {
      try {
        const linkData = await gql<{
          routerPositionEvents: Array<{ plinthPositionId: string; venuePositionId: string }>;
        }>(
          `query RouterLinks($u: Bytes!, $ids: [BigInt!]!) {
            routerPositionEvents(
              where: { user: $u, action: "open", plinthPositionId_in: $ids }
              first: 50
            ) { plinthPositionId venuePositionId }
          }`,
          {
            u: wallet.toLowerCase(),
            ids: data.positions.map((p) => p.id),
          },
        );
        for (const link of linkData.routerPositionEvents ?? []) {
          venueIdByPlinthId.set(link.plinthPositionId, link.venuePositionId);
        }
      } catch {
        // RouterPositionEvent join is best-effort; if the subgraph hiccups
        // we fall back to the Plinth id as before (matches pre-fix shape).
      }
    }
    // Audit KK-5 + KK-6 + KK-7 fix: route was doing `Number(big) / 1e6` in
    // three places — formatAbs() (size column), notionalUsd, entryPrice/
    // markPrice. All lose precision past Number.MAX_SAFE_INTEGER on large
    // notional values. The formatUsd / formatShares helpers preserve it.
    // entryPriceQ64 is Q64.64 fixed-point — the integer part lives in the
    // high 64 bits. Number() on a sane price BigInt is safe (< 2^53), so
    // the >> 64n + Number() is intentional and locked here.
    const positions = (data.positions ?? []).map((p) => {
      const notional = BigInt(p.notionalSigned);
      const abs = notional < 0n ? -notional : notional;
      const entryPriceQ64 = BigInt(p.entryPriceQ64);
      const entryPriceInt = entryPriceQ64 >> 64n;
      // Clamp at Number.MAX_SAFE_INTEGER so an absurd price doesn't ship NaN.
      const entryPriceUsd = entryPriceInt > BigInt(Number.MAX_SAFE_INTEGER)
        ? Number.MAX_SAFE_INTEGER
        : Number(entryPriceInt);
      // Audit U-33: subgraph/src/plinth.ts:90 ships entryPriceQ64 = 0 until
      // Plinth's event-extension-v2 emits the entry price on open. Pre-fix
      // we rendered "$0" for every position's entry — fake-zero matching
      // the U-21 mark/PnL pattern. Now null when unmeasured so the UI
      // shows "—" instead of an honest-looking zero entry.
      const entryPriceMeasured = entryPriceInt > 0n;
      const sizeFormatted = formatShares(abs, USDC_DECIMALS);
      // Phase theta audit follow-up: surface the real venue id when the
      // RouterPositionEvent join succeeded; fall back to the Plinth id
      // when the subgraph hasn't indexed the open event yet (matches
      // pre-fix behavior for backward compatibility).
      const venueSidePositionId = venueIdByPlinthId.get(p.id) ?? p.id;
      return {
        id: p.id,
        plinthPositionId: p.id,
        // Audit U-21 (resolved 2026-05-25): now distinct from `id`. The
        // close action passes both to AtriumRouter.close_position_via_adapter.
        venuePositionId: venueSidePositionId,
        instrument: p.instrumentId.slice(0, 8) + '…',
        venueId: p.venueId,
        venue: venueLabel(p.venueId) ?? `venue-${p.venueId}`,
        size: notional < 0n ? `-${sizeFormatted}` : sizeFormatted,
        notionalUsd: formatUsd(abs, USDC_DECIMALS),
        entryPrice: entryPriceMeasured ? `$${entryPriceUsd.toLocaleString('en-US')}` : null,
        // Audit U-21: pre-fix `markPrice = entryPrice` and `pnlUsd = '$0.00'`
        // were both presented as measured truth, but neither is sourced
        // (no oracle read for mark, no settlement for PnL). A user with a
        // hedged position saw "entry · entry · $0.00 PnL" and could read
        // it as "market is exactly at entry, position is breakeven" —
        // dishonest. Now null with `markSource: 'pending'` so the client
        // renders "—" until the oracle path lands.
        markPrice: null as string | null,
        pnlUsd: null as string | null,
        // Audit U-23: direction null when value null (no measured
        // zero-PnL claim).
        pnlDirection: null as 'up' | 'down' | 'flat' | null,
        markSource: 'pending' as const,
      };
    });
    return NextResponse.json({ positions, source: 'scribe' as const });
  } catch {
    return NextResponse.json({ positions: [], source: 'pending' });
  }
}
