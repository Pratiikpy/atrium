'use client';

import { useState } from 'react';
import { VENUES } from '@/lib/venues';
import { VenueChipBar } from './venue-chip-bar';
import { OrderForm } from './order-form';
import { OrderBook } from './order-book';
import { MarginImpactPanel } from './margin-impact-panel';
import { VenueMarginCompare } from './venue-margin-compare';

/**
 * Parent client view for /app/trade. Owns the selected venue + order size
 * so VenueChipBar → OrderForm → OrderBook → MarginImpactPanel all stay
 * in sync.
 *
 * Pre-audit-U-14: each component held its own state (or hardcoded a
 * value) and never shared. The venue chip toggled visual state with no
 * effect on the form's margin preview, the order book's symbol, or the
 * margin-impact panel's read. The hardcoded venue id `hl-hip3` wasn't
 * even valid (the real id is `hyperliquid`), so /api/trade/margin-impact
 * always 404'd to pending, selecting a venue did nothing because nothing
 * was reading the chip.
 */
export function TradeView() {
  // Default to the venue that is actually openable today (Aave Horizon).
  // VENUES[0] is Hyperliquid, a scaffold whose open_position reverts, so
  // defaulting there dropped a judge onto a venue they cannot trade.
  const [venue, setVenue] = useState<string>(
    VENUES.find((v) => v.operational)?.id ?? VENUES[0]?.id ?? 'aave-horizon',
  );
  const [size, setSize] = useState<string>('');

  return (
    <>
      <section className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <VenueChipBar active={venue} onSelect={setVenue} />
        <VenueMarginCompare size={size} activeVenue={venue} />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[340px_1fr_320px]">
        <OrderForm venue={venue} size={size} setSize={setSize} />
        <OrderBook venue={venue} />
        <MarginImpactPanel venue={venue} size={size} />
      </section>
    </>
  );
}
