'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { hedgeFreedBps, type PositionView } from '@/lib/span-margin';
import { VENUES, venueLabel } from '@/lib/venues';
import { formatUsd } from '@/lib/format-usd';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

/**
 * Margin Lens (2026-06-10). The portfolio's netting moment: isolated-sum vs
 * SPAN-netted margin, side by side, for (a) the connected wallet's LIVE book
 * and (b) a worked hedged book, so the one thing Atrium uniquely does is
 * visible on the first screen instead of living in a notebook.
 *
 * Honesty contract for this card:
 *  - Live-book margins are computed CLIENT-SIDE by lib/span-margin.ts, the
 *    line-for-line TS port of contracts/plinth/src/span.rs (parity-tested in
 *    span-margin.test.ts). The card says so; it never claims these exact
 *    numbers were read from the chain.
 *  - The scenario view prices each leg at entry = mark (the subgraph ships
 *    entryPriceQ64 = 0 until Plinth's event extension lands, so unrealized
 *    PnL is unmeasured). The freed RATIO is scale-invariant to that choice.
 *  - Parameters are the published worked-example set (5% notional floor, 2%
 *    maintenance buffer), the same pair the markets-page combos disclose.
 *  - Correlation classes follow the venue kind in lib/venues.ts (cash-like
 *    venues net in the collateral class, perp venues in the perp class),
 *    mirroring how the combos bucket the same venues.
 *  - The hedged example is labelled "worked example". A book with no
 *    offsetting risk honestly shows 0% freed, never a fabricated benefit.
 *  - The invariant the engine guarantees (hedged <= isolated) is the one the
 *    Kani proof in span.rs covers; the card links the architecture page.
 */

const WORKED_MIN_INITIAL_BPS = 500; // 5% notional floor, the disclosed worked-example param
const WORKED_MAINT_BUFFER_BPS = 200; // 2% maintenance buffer
const FLAT_PRICE_Q64 = 1_000n; // entry = mark; the freed ratio is scale-invariant

/** Correlation class per venue kind, matching the markets-page combos. */
function classForVenue(venueId: number): number {
  const kind = VENUES.find((v) => v.venueId === venueId)?.kind;
  return kind === 'cash-equiv' || kind === 'yield-bearing' ? 3 : 1;
}

interface ApiPosition {
  id: string;
  venueId: number;
  notionalSignedRaw?: string;
  size: string;
}

async function fetchPositions(wallet: string | null): Promise<ApiPosition[]> {
  try {
    const r = await fetch(walletQuery('/api/portfolio/positions', wallet));
    if (!r.ok) throw new Error();
    const j = await r.json();
    return Array.isArray(j.positions) ? j.positions : [];
  } catch {
    return [];
  }
}

function toView(p: ApiPosition): PositionView | null {
  if (!p.notionalSignedRaw) return null;
  let notional: bigint;
  try {
    notional = BigInt(p.notionalSignedRaw);
  } catch {
    return null;
  }
  if (notional === 0n) return null;
  return {
    notionalSigned: notional,
    entryPriceQ64: FLAT_PRICE_Q64,
    currentPriceQ64: FLAT_PRICE_Q64,
    haircutBps: 0,
    correlationClass: classForVenue(p.venueId),
  };
}

/** The worked hedged book: the cross-venue basis pair from the combos. */
const WORKED_LEGS: { label: string; side: 'Long' | 'Short'; view: PositionView }[] = [
  {
    label: 'ETH-PERP · Hyperliquid HIP-3',
    side: 'Long',
    view: {
      notionalSigned: 100_000n,
      entryPriceQ64: FLAT_PRICE_Q64,
      currentPriceQ64: FLAT_PRICE_Q64,
      haircutBps: 1000,
      correlationClass: 1,
    },
  },
  {
    label: 'ETH-PERP · Hyperliquid HIP-4',
    side: 'Short',
    view: {
      notionalSigned: -100_000n,
      entryPriceQ64: FLAT_PRICE_Q64,
      currentPriceQ64: FLAT_PRICE_Q64,
      haircutBps: 1000,
      correlationClass: 1,
    },
  },
];

function pct(freedBps: bigint): string {
  return (Number(freedBps) / 100).toFixed(1);
}

function Bars({
  isolated,
  hedged,
  fmt,
}: {
  isolated: bigint;
  hedged: bigint;
  fmt: (v: bigint) => string;
}) {
  const hedgedPct =
    isolated > 0n ? Math.max(2, Math.round((Number(hedged) / Number(isolated)) * 100)) : 100;
  return (
    <div className="space-y-2.5">
      <div>
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="text-muted">Each leg margined alone (sum)</span>
          <span className="font-mono text-ink">{fmt(isolated)}</span>
        </div>
        <div className="mt-1 h-2 w-full rounded-full bg-ink/15">
          <div className="h-2 rounded-full bg-ink/55" style={{ width: '100%' }} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="text-muted">Netted as one portfolio (Plinth)</span>
          <span className="font-mono text-ink">{fmt(hedged)}</span>
        </div>
        <div className="mt-1 h-2 w-full rounded-full bg-ink/15">
          <div
            className="h-2 rounded-full"
            style={{ width: `${hedgedPct}%`, background: 'var(--color-live, oklch(0.58 0.13 145))' }}
          />
        </div>
      </div>
    </div>
  );
}

export function MarginLensCard() {
  const wallet = useScopedWallet();
  const { data: positions, isLoading } = useQuery({
    queryKey: ['margin-lens-positions', wallet],
    queryFn: () => fetchPositions(wallet),
    enabled: wallet != null,
    refetchInterval: 30_000,
  });

  const liveViews = (positions ?? [])
    .map(toView)
    .filter((v): v is PositionView => v != null);
  const live =
    liveViews.length > 0
      ? hedgeFreedBps(liveViews, WORKED_MIN_INITIAL_BPS, WORKED_MAINT_BUFFER_BPS)
      : null;
  const worked = hedgeFreedBps(
    WORKED_LEGS.map((l) => l.view),
    WORKED_MIN_INITIAL_BPS,
    WORKED_MAINT_BUFFER_BPS,
  );

  return (
    <div className="rounded-md border border-divider bg-parchment-light p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow">Margin lens · SPAN netting</p>
          <h2 className="mt-1 font-display text-2xl italic text-ink">
            One book, one margin number.
          </h2>
        </div>
        <span className="rounded-full border border-divider bg-parchment px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
          span.rs parity engine
        </span>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        {/* ── Your live book ─────────────────────────────────────── */}
        <section className="rounded-md border border-divider bg-parchment p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted">Your live book</p>
          {wallet == null ? (
            <p className="mt-3 text-sm text-ink-soft">
              Connect a wallet and this panel runs the SPAN scenario grid over your real
              positions, the same way Plinth margins them on-chain.
            </p>
          ) : isLoading ? (
            <div className="mt-3 space-y-2">
              <span className="skeleton block h-3 w-3/4 rounded" />
              <span className="skeleton block h-3 w-1/2 rounded" />
            </div>
          ) : liveViews.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              No open positions yet.{' '}
              <Link href="/app/trade" className="underline decoration-divider underline-offset-2 hover:text-ink">
                Open one
              </Link>{' '}
              and your book appears here, netted.
            </p>
          ) : (
            <>
              <ul className="mt-2.5 space-y-1 font-mono text-[11px] text-ink-soft">
                {(positions ?? [])
                  .filter((p) => p.notionalSignedRaw && p.notionalSignedRaw !== '0')
                  .slice(0, 4)
                  .map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span className="truncate">{venueLabel(p.venueId) ?? `venue-${p.venueId}`}</span>
                      <span>{p.size}</span>
                    </li>
                  ))}
              </ul>
              <div className="mt-3.5">
                <Bars
                  isolated={live!.isolatedMargin}
                  hedged={live!.hedgedMargin}
                  fmt={(v) => formatUsd(v, 6)}
                />
              </div>
              <p className="mt-3 font-mono text-sm text-ink">
                Netting frees{' '}
                <span className="text-xl">{pct(live!.freedBps)}%</span>
                {live!.freedBps === 0n && (
                  <span className="ml-2 text-[11px] text-muted">
                    your legs share one direction, so nothing offsets yet
                  </span>
                )}
              </p>
              {live!.freedBps === 0n && (
                <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">
                  Open an offsetting leg and watch this number move. The engine never
                  invents a benefit a book does not have.
                </p>
              )}
            </>
          )}
        </section>

        {/* ── The hedged worked example ──────────────────────────── */}
        <section className="rounded-md border border-divider bg-parchment p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider text-muted">A hedged book</p>
            <span className="rounded-sm bg-ink/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ink-soft">
              worked example
            </span>
          </div>
          <ul className="mt-2.5 space-y-1 font-mono text-[11px] text-ink-soft">
            {WORKED_LEGS.map((l) => (
              <li key={l.label} className="flex justify-between gap-2">
                <span className="truncate">{l.label}</span>
                <span>{l.side} $100,000</span>
              </li>
            ))}
          </ul>
          <div className="mt-3.5">
            <Bars
              isolated={worked.isolatedMargin}
              hedged={worked.hedgedMargin}
              fmt={(v) => `$${Number(v).toLocaleString('en-US')}`}
            />
          </div>
          <p className="mt-3 font-mono text-sm text-ink">
            Netting frees <span className="text-xl">{pct(worked.freedBps)}%</span>
          </p>
        </section>
      </div>

      <p className="mt-4 rounded-md bg-parchment-soft/60 px-4 py-3 text-[11px] leading-snug text-ink-soft">
        Computed client-side by the TypeScript parity port of Plinth&apos;s span.rs
        (scenario grid at entry = mark, worked-example parameters: 5% floor, 2% buffer).
        The on-chain engine runs the same grid per block; its core invariant, a hedged
        book never needs more margin than its legs do alone, is Kani-proven.{' '}
        <Link
          href="/architecture"
          className="underline decoration-divider underline-offset-2 hover:text-ink"
        >
          How the engine works
        </Link>
      </p>
    </div>
  );
}
