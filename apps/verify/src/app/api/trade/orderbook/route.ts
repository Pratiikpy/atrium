import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Hyperliquid info-feed proxy. Pulls L2 book for the requested symbol from
 * the public Hyperliquid info endpoint. Returns honest "pending" if the
 * endpoint is unreachable or the symbol is unknown.
 */
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') ?? 'HSLA-PERP';
  try {
    const r = await fetch('https://api.hyperliquid-testnet.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'l2Book', coin: symbol.replace(/-PERP$/, '') }),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) throw new Error('hl_info_fail');
    const json: { levels?: Array<Array<{ px: string; sz: string }>> } = await r.json();
    const [bidsRaw, asksRaw] = json.levels ?? [[], []];
    const bids = (bidsRaw ?? []).slice(0, 12).map((b) => ({ price: b.px, size: b.sz, side: 'bid' as const }));
    const asks = (asksRaw ?? []).slice(0, 12).map((a) => ({ price: a.px, size: a.sz, side: 'ask' as const }));
    // Audit KK-2 fix: prior code did `parseFloat(...).toFixed(2)` without
    // guarding NaN. If the HL info feed returned a malformed price string,
    // `mid` shipped as the literal string "NaN" to the UI. Now we validate
    // both sides parse to finite numbers before averaging.
    const bidPx = bids[0] ? parseFloat(bids[0].price) : NaN;
    const askPx = asks[0] ? parseFloat(asks[0].price) : NaN;
    const mid = Number.isFinite(bidPx) && Number.isFinite(askPx)
      ? ((bidPx + askPx) / 2).toFixed(2)
      : '-';
    // Iteration 40 audit fix: pre-fix returned midDelta24h:'0.00' and
    // midDeltaDirection:'flat' as hardcoded constants. There is no 24h-
    // delta computation in this route, the values were never sourced from
    // anywhere. The UI rendered "$X 0.00 · 24h" implying a measured
    // no-change. Now: null in both fields when unmeasured. The component
    // handles null with "-" instead of fake-zero. Once a 24h-delta source
    // lands (HL info feed has a 24h-price endpoint), wire it here and
    // both fields become real measurements.
    return NextResponse.json({
      symbol,
      midPrice: mid,
      midDelta24h: null,
      midDeltaDirection: null,
      bids,
      asks,
      source: 'hyperliquid' as const,
    });
  } catch {
    return NextResponse.json({
      symbol,
      midPrice: '-',
      midDelta24h: null,
      midDeltaDirection: null,
      bids: [],
      asks: [],
      source: 'pending',
    });
  }
}
