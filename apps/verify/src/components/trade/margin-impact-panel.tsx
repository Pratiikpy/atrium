'use client';

import { useQuery } from '@tanstack/react-query';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

interface MarginImpact {
  buyingPowerAfterUsd: string | null;
  liquidationBufferBps: number | null;
  initialMarginUsd: string | null;
  maintenanceMarginUsd: string | null;
  notes: string;
  source: 'plinth' | 'pending';
}

async function fetchImpact(venue: string, size: string, wallet: string | null): Promise<MarginImpact> {
  // Audit U-14: venue + size now come from the parent TradeView state.
  // Pre-fix the URL was `?size=1200&venue=hl-hip3` — but `hl-hip3` isn't
  // even a valid venue id (real id is `hyperliquid`), so the request always
  // returned the pending fallback. Changing the venue chip had no effect
  // because nothing read it. Size was hardcoded 1200 even when the user
  // hadn't typed an amount.
  if (!size || parseFloat(size) <= 0) {
    return {
      buyingPowerAfterUsd: null,
      liquidationBufferBps: null,
      initialMarginUsd: null,
      maintenanceMarginUsd: null,
      notes: 'Open a position to preview impact.',
      source: 'pending',
    };
  }
  try {
    const r = await fetch(
      walletQuery(
        `/api/trade/margin-impact?size=${encodeURIComponent(size)}&venue=${encodeURIComponent(venue)}`,
        wallet,
      ),
    );
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return {
      buyingPowerAfterUsd: null,
      liquidationBufferBps: null,
      initialMarginUsd: null,
      maintenanceMarginUsd: null,
      notes: 'Open a position to preview impact.',
      source: 'pending',
    };
  }
}

export function MarginImpactPanel({ venue, size }: { venue: string; size: string }) {
  const wallet = useScopedWallet();
  const { data } = useQuery({
    queryKey: ['margin-impact', venue, size, wallet],
    queryFn: () => fetchImpact(venue, size, wallet),
    refetchInterval: 10_000,
  });
  return (
    <aside className="rounded-md border border-divider bg-parchment p-5">
      <p className="eyebrow">Margin impact</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">What would be assumed</p>

      <p className="mt-4 font-mono text-3xl text-ink">{data?.buyingPowerAfterUsd ?? '—'}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">Buying power with new position</p>

      <div className="mt-6 rounded-md bg-parchment-soft/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-muted">Liquidation buffer</p>
        <p className="mt-1 font-mono text-xl text-ink">
          {data?.liquidationBufferBps != null ? `${(data.liquidationBufferBps / 100).toFixed(1)}%` : '—'}
        </p>
      </div>

      <dl className="mt-5 space-y-1.5 text-xs">
        <Row label="Initial margin" value={data?.initialMarginUsd ?? '—'} />
        <Row label="Maintenance margin" value={data?.maintenanceMarginUsd ?? '—'} />
      </dl>

      <p className="mt-5 text-[10px] uppercase tracking-wider text-muted">Position effects</p>
      <p className="mt-2 text-[11px] text-ink-soft">{data?.notes}</p>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between font-mono">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
