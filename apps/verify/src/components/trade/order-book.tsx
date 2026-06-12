'use client';

import { useQuery } from '@tanstack/react-query';
import { VENUES } from '@/lib/venues';

interface OrderBookLevel {
  price: string;
  size: string;
  side: 'bid' | 'ask';
}
interface BookResponse {
  symbol: string;
  midPrice: string;
  // Iteration 40: was `string` with hardcoded "0.00" default, implied a
  // measured no-change. Now null when no 24h-delta source is wired.
  midDelta24h: string | null;
  midDeltaDirection: 'up' | 'down' | 'flat' | null;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  source: 'hyperliquid' | 'pending';
}

// Audit U-14: venue-aware symbol resolution. Pre-fix the orderbook always
// fetched `?symbol=HSLA-PERP` regardless of which venue chip was selected.
// Now the venue id drives the symbol so HL-HIP3 / Trade.xyz / Pendle each
// show their own market. Map is small enough that hardcoding is fine -
// adding a new venue is a one-line change here + in @/lib/venues. The
// resolver is exported so the unit test pins each id → symbol pair.
const SYMBOL_BY_VENUE: Record<string, string> = {
  hyperliquid: 'HSLA-PERP',
  'aave-horizon': 'USDC-LEND',
  'pendle-v2': 'PT-USDC-DEC25',
  curve: '3CRV',
  'trade-xyz': 'rTSLA-PERP',
  polymarket: 'ELECTION-2026',
  'hl-hip4': 'HSLA2-PERP',
};

export function symbolForVenue(venueId: string): string {
  return SYMBOL_BY_VENUE[venueId] ?? 'HSLA-PERP';
}

/**
 * n=10: venue-aware empty-book message. Pre-fix this was hardcoded to
 * "Hyperliquid HIP-3" regardless of the selected venue, so the panel for the
 * one openable venue (Aave Horizon, a lending market with no perp order book)
 * told the user to wait on a different venue's adapter. Now:
 *  - operational lending/cash-equiv markets explain they have no perp book
 *  - non-operational scaffold venues name the SELECTED venue's pending adapter
 */
export function emptyBookMessage(venueId: string): string {
  const venue = VENUES.find((v) => v.id === venueId);
  const label = venue?.label ?? 'this venue';
  const symbol = symbolForVenue(venueId);
  if (venue?.operational && venue.kind === 'cash-equiv') {
    return `${label} is a lending market, so it has no perp order book. Margin and positions update from on-chain reserves.`;
  }
  return `Order book for ${symbol} populates once the ${label} adapter routes through Aqueduct.`;
}

async function fetchBook(venue: string): Promise<BookResponse> {
  const symbol = symbolForVenue(venue);
  try {
    const r = await fetch(`/api/trade/orderbook?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return {
      symbol,
      midPrice: '-',
      midDelta24h: null,
      midDeltaDirection: null,
      bids: [],
      asks: [],
      source: 'pending',
    };
  }
}

export function OrderBook({ venue }: { venue: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['orderbook', venue],
    queryFn: () => fetchBook(venue),
    refetchInterval: 5_000,
  });
  const source = data?.source;
  return (
    <section className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-sm text-ink">{data?.symbol ?? '-'}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
            {source === 'hyperliquid' ? 'Hyperliquid info feed' : 'orderbook pending'}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl text-ink">{data?.midPrice ?? '-'}</p>
          {/* Iteration 40: render "- · 24h" instead of "0.00 · 24h" when no
              24h-delta source is wired. Pre-fix the hardcoded "0.00"
              implied a measured no-change to anyone reading the UI. */}
          <p
            className={
              'text-[10px] uppercase tracking-wider ' +
              (data?.midDeltaDirection === 'up'
                ? 'text-live'
                : data?.midDeltaDirection === 'down'
                ? 'text-neg'
                : 'text-muted')
            }
          >
            {data?.midDeltaDirection === 'up' && '+'}
            {data?.midDelta24h ?? '-'} · 24h
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="mt-5 space-y-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton h-5 rounded" />
          ))}
        </div>
      ) : (data?.bids.length === 0 && data?.asks.length === 0) ? (
        <div className="mt-12 text-center text-sm text-muted">
          {emptyBookMessage(venue)}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <Side title="Bids" levels={data?.bids ?? []} side="bid" />
          <Side title="Asks" levels={data?.asks ?? []} side="ask" />
        </div>
      )}

      <footer className="mt-6 flex items-center justify-between rounded-md bg-parchment-soft/60 px-4 py-2 text-[10px] uppercase tracking-wider">
        <span className="text-muted">MID</span>
        <span className="font-mono text-ink">{data?.midPrice ?? '-'}</span>
      </footer>
    </section>
  );
}

function Side({ title, levels, side }: { title: string; levels: OrderBookLevel[]; side: 'bid' | 'ask' }) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">{title}</p>
      <ol className="space-y-0.5">
        {levels.slice(0, 12).map((l, i) => (
          <li key={i} className="flex justify-between rounded px-1.5 py-0.5 font-mono hover:bg-parchment-soft/60">
            <span className={side === 'bid' ? 'text-live' : 'text-neg'}>{l.price}</span>
            <span className="text-ink-soft">{l.size}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
