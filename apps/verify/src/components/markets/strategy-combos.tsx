import type { ReactNode } from 'react';
import Link from 'next/link';
import { hedgeFreedBps, requiredMargin, type PositionView } from '@/lib/span-margin';

/**
 * Starter strategies (BUILD_PLAN Phase 1, item 8): turn the venue catalog into
 * a benefit. Each combo shows the cross-margin story concretely with numbers
 * computed by the SAME SPAN engine Plinth runs on-chain (the TypeScript port in
 * lib/span-margin.ts, parity-tested against contracts/plinth/src/span.rs).
 *
 * Honesty contract (.claude/rules/writing.md + CLAUDE.md "no fake numbers"):
 *  - The dollar figures are a worked example at a fixed notional, computed by
 *    the real scenario engine with the example parameters stated on the card
 *    (5% initial-margin floor, 2% maintenance buffer). The user's real,
 *    personalized requirement comes from Plinth's per-instrument risk params,
 *    live on /app/trade. We label the example as illustrative and never present
 *    it as the user's number.
 *  - We only claim netting where the v1 engine actually nets. v1 nets opposing
 *    positions WITHIN a correlation class and gives NO cross-class
 *    diversification credit (span.rs: "Sum worst-case losses across classes").
 *    The basis combo is a same-class hedge, so its freed % is real; the carry
 *    combo is collateral efficiency (one balance does two jobs), not scenario
 *    netting, and is framed that way.
 *
 * Pre-2026-06-02 this file claimed "Plinth nets the two correlation classes" for
 * a long-ETH / long-NVDA pair in DIFFERENT classes, which the engine frees 0% on,
 * and showed the netted figure as a vague "<= sum". Both are corrected here.
 */

const EXAMPLE_MIN_INITIAL_BPS = 500; // 5% notional floor (worked-example param)
const EXAMPLE_MAINT_BUFFER_BPS = 200; // 2% maintenance buffer (worked-example param)
const EXAMPLE_PRICE = 1_000n; // arbitrary entry == mark; the margin ratio is scale-invariant

interface Leg {
  venue: string;
  instrument: string;
  direction: 'Long' | 'Short';
  exampleNotionalUsd: number;
  /** Correlation class index, matching how Plinth groups correlated instruments. */
  correlationClass: number;
  correlationLabel: string;
  /** The venue's published initial-margin weight, shown for context. */
  publishedHaircutPct: number;
  role: string;
}

interface Combo {
  id: string;
  name: string;
  tag: string;
  thesis: string;
  legs: Leg[];
  /** 'netting' = real same-class SPAN netting; 'collateral' = collateral efficiency. */
  kind: 'netting' | 'collateral';
  benefit: string;
}

const COMBOS: Combo[] = [
  {
    id: 'basis',
    name: 'Cross-venue basis',
    tag: 'Same-class hedge',
    thesis:
      'Long ETH-PERP on one Hyperliquid market, short the same ETH-PERP on another. Same underlying, opposing direction. Plinth nets the offsetting scenario risk into one margin account.',
    kind: 'netting',
    legs: [
      {
        venue: 'Hyperliquid HIP-3',
        instrument: 'ETH-PERP',
        direction: 'Long',
        exampleNotionalUsd: 100_000,
        correlationClass: 1,
        correlationLabel: 'CRYPTO_PERP',
        publishedHaircutPct: 10,
        role: 'Long leg',
      },
      {
        venue: 'Hyperliquid HIP-4',
        instrument: 'ETH-PERP',
        direction: 'Short',
        exampleNotionalUsd: 100_000,
        correlationClass: 1,
        correlationLabel: 'CRYPTO_PERP',
        publishedHaircutPct: 10,
        role: 'Short leg, same correlation class',
      },
    ],
    benefit:
      'The two legs share a correlation class and point opposite ways, so they cancel under every price-shock scenario. Margined separately you post both; pooled in Plinth you post only the residual plus the notional floor.',
  },
  {
    id: 'carry',
    name: 'Collateral that earns',
    tag: 'Capital efficiency',
    thesis:
      'Park collateral in tokenized T-bills and use the same balance to margin a perp. The cash keeps earning while it backs the position.',
    kind: 'collateral',
    legs: [
      {
        venue: 'Aave Horizon',
        instrument: 'USTB (tokenized T-bill)',
        direction: 'Long',
        exampleNotionalUsd: 100_000,
        correlationClass: 3,
        correlationLabel: 'CASH_EQUIV collateral',
        publishedHaircutPct: 1,
        role: 'Posts as collateral, keeps earning yield',
      },
      {
        venue: 'Hyperliquid',
        instrument: 'ETH-PERP',
        direction: 'Long',
        exampleNotionalUsd: 100_000,
        correlationClass: 1,
        correlationLabel: 'CRYPTO_PERP',
        publishedHaircutPct: 10,
        role: 'Directional perp, needs initial margin',
      },
    ],
    benefit:
      'This is collateral efficiency, not scenario netting. The T-bill counts as collateral (a small haircut) and keeps paying yield while it backs the perp. Without unified margin you would fund the perp from a second, idle balance.',
  },
];

function legToPosition(l: Leg): PositionView {
  const notional = BigInt(l.exampleNotionalUsd);
  return {
    notionalSigned: l.direction === 'Short' ? -notional : notional,
    entryPriceQ64: EXAMPLE_PRICE,
    currentPriceQ64: EXAMPLE_PRICE,
    haircutBps: l.publishedHaircutPct * 100,
    correlationClass: l.correlationClass,
  };
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function StrategyCombos() {
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Starter strategies</p>
          <h2 className="mt-1 font-display text-2xl text-ink">Two venues, one margin account</h2>
        </div>
        <Link href="/app/trade" className="text-sm text-ink underline-offset-2 hover:underline">
          Open the live margin compare on Trade
        </Link>
      </div>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">
        Cross-margin means a single deposit backs positions across venues instead of re-posting at
        each. Below: two live combos, with figures from the same SPAN engine Plinth runs on-chain at
        a $100K-per-leg worked example. Your real number computes live from Plinth on the trade
        screen.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {COMBOS.map((c) => {
          const positions = c.legs.map(legToPosition);

          if (c.kind === 'netting') {
            // Real SPAN netting: each leg alone vs the pooled book, from the engine.
            const { isolatedMargin, hedgedMargin, freedBps } = hedgeFreedBps(
              positions,
              EXAMPLE_MIN_INITIAL_BPS,
              EXAMPLE_MAINT_BUFFER_BPS,
            );
            const siloed = Number(isolatedMargin);
            const netted = Number(hedgedMargin);
            const freedPct = Number(freedBps) / 100;
            return (
              <ComboCard key={c.id} combo={c}>
                <div className="mt-4 rounded-md bg-parchment-soft/60 px-4 py-3 text-[12px]">
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    Illustrative · $100K per leg · SPAN engine · 5% floor, 2% buffer
                  </p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-ink-soft">Each leg margined alone (sum)</span>
                    <span className="font-mono text-ink">${fmtUsd(siloed)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-ink-soft">Pooled in Plinth (SPAN-netted)</span>
                    <span className="font-mono text-live">${fmtUsd(netted)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between border-t border-divider/60 pt-1.5">
                    <span className="font-medium text-ink">Cross-margin frees</span>
                    <span className="font-mono font-medium text-live">{freedPct.toFixed(0)}%</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-muted">{c.benefit}</p>
                </div>
              </ComboCard>
            );
          }

          // Collateral efficiency: show the perp's real SPAN margin, framed as
          // one balance doing two jobs (NOT a scenario-netting reduction).
          const perpLeg = c.legs.find((l) => l.correlationClass !== 3) ?? c.legs[1];
          const perpMargin = Number(
            requiredMargin([legToPosition(perpLeg)], EXAMPLE_MIN_INITIAL_BPS, EXAMPLE_MAINT_BUFFER_BPS),
          );
          return (
            <ComboCard key={c.id} combo={c}>
              <div className="mt-4 rounded-md bg-parchment-soft/60 px-4 py-3 text-[12px]">
                <p className="text-[10px] uppercase tracking-wider text-muted">
                  Illustrative · $100K T-bill · SPAN engine · 5% floor, 2% buffer
                </p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-ink-soft">Collateral posted (keeps earning)</span>
                  <span className="font-mono text-ink">$100,000</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-ink-soft">Perp initial margin it covers</span>
                  <span className="font-mono text-live">${fmtUsd(perpMargin)}</span>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-muted">{c.benefit}</p>
              </div>
            </ComboCard>
          );
        })}
      </div>

      <p className="mt-4 max-w-prose text-[11px] leading-snug text-muted">
        Numbers come from the SPAN engine in lib/span-margin.ts, parity-tested against the deployed
        Plinth scenario math. v1 nets opposing positions within a correlation class; it does not give
        cross-class diversification credit, so a book of unrelated instruments pools its collateral
        but keeps each class's full scenario margin.
      </p>
    </section>
  );
}

function ComboCard({ combo, children }: { combo: Combo; children: ReactNode }) {
  return (
    <article className="rounded-md border border-divider bg-parchment p-6">
      <header className="flex items-baseline justify-between gap-3">
        <p className="font-display text-xl text-ink">{combo.name}</p>
        <span className="rounded-full border border-divider px-3 py-1 text-[11px] uppercase tracking-wider text-muted">
          {combo.tag}
        </span>
      </header>
      <p className="mt-2 text-sm text-ink-soft">{combo.thesis}</p>

      <div className="mt-4 space-y-2">
        {combo.legs.map((l) => (
          <div
            key={l.venue + l.instrument}
            className="rounded-md border border-divider/60 bg-parchment-soft/40 px-4 py-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-ink">
                <span className="text-[10px] uppercase tracking-wider text-muted">{l.direction}</span>{' '}
                {l.venue} · <span className="font-mono text-xs">{l.instrument}</span>
              </p>
              <p className="font-mono text-xs text-muted">{l.publishedHaircutPct}% haircut</p>
            </div>
            <p className="mt-1 text-[11px] text-muted">{l.role}</p>
          </div>
        ))}
      </div>

      {children}
    </article>
  );
}
