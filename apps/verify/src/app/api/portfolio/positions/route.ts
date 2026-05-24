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

export async function GET() {
  const wallet = process.env.DEMO_WALLET_ADDRESS ?? null;
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
      return {
        id: p.id,
        // Audit U-21: `id` from Scribe is the on-chain Plinth position id.
        // Expose it explicitly as `venuePositionId` so the client's close
        // action passes it back to the adapter's close_position(uint256,...)
        // without relying on schema-knowledge.
        venuePositionId: p.id,
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
