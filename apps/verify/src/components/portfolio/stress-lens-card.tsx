'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  classScenarioLoss,
  MAX_CORRELATION_CLASSES,
  type PositionView,
} from '@/lib/span-margin';
import { VENUES, venueLabel } from '@/lib/venues';
import { formatUsd } from '@/lib/format-usd';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

/**
 * Stress Lens (2026-06-13). The storm view of the SPAN engine: how much margin
 * the book requires as a market shock escalates, and at what severity it would
 * breach the posted collateral. The companion to the Margin Lens (calm netting)
 * answering the question a risk desk actually asks: "how big a move can this
 * book take before it liquidates, and does netting buy survival room?"
 *
 * Honesty contract (same spine as the Margin Lens):
 *  - Storm-state margin is computed CLIENT-SIDE with the exported primitives of
 *    lib/span-margin.ts, the line-for-line TS port of contracts/plinth/src/
 *    span.rs (parity-tested). `stormMargin` mirrors span.rs `required_margin`
 *    exactly, but evaluates ONE adverse scenario of the storm magnitude per
 *    correlation class (worst of up/down), instead of the engine's fixed
 *    +/-10% grid. It is the same method at a larger shock, not a new model.
 *  - Legs are priced entry = mark (the subgraph ships entryPriceQ64 = 0 until
 *    Plinth's event extension lands), so this measures the shock's impact on
 *    margin STRUCTURE, which is scale-invariant, not a dollar PnL on top of an
 *    unmeasured unrealized PnL. The card says so.
 *  - The live book's storm margin (raw 1e6 USDC scale) is compared against the
 *    REAL on-chain collateral from /api/portfolio/summary (Coffer convertToAssets,
 *    same scale), so the breach point is honest, not assumed.
 *  - There is no "time to liquidation" clock: testnet has no live oracle marks
 *    or funding, so there is no real decay rate to count down. We show the
 *    honest thing instead, the shock severity that breaches margin, and that
 *    Vigil soft-liquidates before the book goes underwater.
 *  - A book with no offsetting risk shows its real (higher) storm margin; the
 *    engine never invents survival room a book does not have.
 */

const MIN_INITIAL_BPS = 500; // 5% notional floor, the disclosed worked-example param
const MAINT_BUFFER_BPS = 200; // 2% maintenance buffer
const FLAT_PRICE_Q64 = 1_000n; // entry = mark; the storm ratio is scale-invariant
const BPS_DENOM = 10_000n;

/** Storm scenarios: a calm baseline plus escalating adverse moves. */
const STORMS: ReadonlyArray<{ key: string; label: string; magBps: number }> = [
  { key: 'calm', label: 'Calm', magBps: 0 },
  { key: 'squall', label: 'Squall -10%', magBps: 1_000 },
  { key: 'storm', label: 'Storm -20%', magBps: 2_000 },
  { key: 'crash', label: 'Crash -35%', magBps: 3_500 },
];

/**
 * Storm-state margin: span.rs `required_margin` evaluated at a single adverse
 * scenario of `magBps` per correlation class (worst of up/down), + maintenance
 * buffer, floored at the min-initial notional floor. magBps 0 returns the floor
 * (the calm baseline). Uses only the exported, parity-tested primitives.
 */
function stormMargin(positions: PositionView[], magBps: number): bigint {
  if (positions.length === 0) return 0n;
  let total = 0n;
  for (let c = 0; c < MAX_CORRELATION_CLASSES; c++) {
    const up = classScenarioLoss(positions, c, 1, magBps);
    const down = classScenarioLoss(positions, c, -1, magBps);
    total += up > down ? up : down;
  }
  const withBuffer = total + (total * BigInt(MAINT_BUFFER_BPS)) / BPS_DENOM;
  let notional = 0n;
  for (const p of positions) notional += p.notionalSigned < 0n ? -p.notionalSigned : p.notionalSigned;
  const floor = (notional * BigInt(MIN_INITIAL_BPS)) / BPS_DENOM;
  return withBuffer > floor ? withBuffer : floor;
}

/** Correlation class per venue kind, matching the Margin Lens + markets combos. */
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

async function fetchCollateralRaw(wallet: string | null): Promise<bigint | null> {
  try {
    const r = await fetch(walletQuery('/api/portfolio/summary', wallet));
    if (!r.ok) throw new Error();
    const j = await r.json();
    // totalCollateralUsd is a formatted string like "12.34"; parse to 1e6 scale.
    if (typeof j.totalCollateralUsd !== 'string') return null;
    const n = Number(j.totalCollateralUsd.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n)) return null;
    return BigInt(Math.round(n * 1e6));
  } catch {
    return null;
  }
}

/** The hedged worked example (mirrors the Margin Lens worked pair). */
const WORKED_LEGS: PositionView[] = [
  { notionalSigned: 100_000n, entryPriceQ64: FLAT_PRICE_Q64, currentPriceQ64: FLAT_PRICE_Q64, haircutBps: 1000, correlationClass: 1 },
  { notionalSigned: -100_000n, entryPriceQ64: FLAT_PRICE_Q64, currentPriceQ64: FLAT_PRICE_Q64, haircutBps: 1000, correlationClass: 1 },
];

/** The first storm severity at which margin exceeds collateral, or null if none. */
function breachStorm(positions: PositionView[], collateral: bigint): typeof STORMS[number] | null {
  for (const s of STORMS) {
    if (s.magBps === 0) continue;
    if (stormMargin(positions, s.magBps) > collateral) return s;
  }
  return null;
}

function StormBars({
  rows,
  max,
  fmt,
}: {
  rows: { label: string; value: bigint; breached?: boolean }[];
  max: bigint;
  fmt: (v: bigint) => string;
}) {
  return (
    <div className="mt-3 space-y-2">
      {rows.map((r) => {
        const pct = max > 0n ? Math.max(3, Math.round((Number(r.value) / Number(max)) * 100)) : 3;
        return (
          <div key={r.label}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-muted">{r.label}</span>
              <span className={'font-mono ' + (r.breached ? 'text-neg' : 'text-ink')}>{fmt(r.value)}</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-ink/12">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${pct}%`,
                  background: r.breached ? 'var(--color-neg, oklch(0.55 0.16 25))' : 'var(--color-live, oklch(0.58 0.13 145))',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StressLensCard() {
  const wallet = useScopedWallet();
  const { data: positions, isLoading } = useQuery({
    queryKey: ['stress-lens-positions', wallet],
    queryFn: () => fetchPositions(wallet),
    enabled: wallet != null,
    refetchInterval: 30_000,
  });
  const { data: collateralRaw } = useQuery({
    queryKey: ['stress-lens-collateral', wallet],
    queryFn: () => fetchCollateralRaw(wallet),
    enabled: wallet != null,
    refetchInterval: 30_000,
  });

  const liveViews = (positions ?? []).map(toView).filter((v): v is PositionView => v != null);

  // Worked example: hedged book vs the same legs margined alone, under each storm.
  const workedHedged = STORMS.map((s) => stormMargin(WORKED_LEGS, s.magBps));
  const workedIsolated = STORMS.map((s) =>
    WORKED_LEGS.reduce((acc, leg) => acc + stormMargin([leg], s.magBps), 0n),
  );
  const workedMax = workedIsolated[workedIsolated.length - 1];
  const crashHedged = workedHedged[workedHedged.length - 1];
  const crashIsolated = workedIsolated[workedIsolated.length - 1];
  const crashFreedPct =
    crashIsolated > 0n ? Math.round((Number(crashIsolated - crashHedged) / Number(crashIsolated)) * 100) : 0;

  const liveStormRows = liveViews.length
    ? STORMS.map((s) => {
        const m = stormMargin(liveViews, s.magBps);
        return { label: s.label, value: m, breached: collateralRaw != null && m > collateralRaw };
      })
    : [];
  const liveMax = liveStormRows.length
    ? liveStormRows.reduce((mx, r) => (r.value > mx ? r.value : mx), 0n)
    : 0n;
  const breach = liveViews.length && collateralRaw != null ? breachStorm(liveViews, collateralRaw) : null;

  return (
    <div className="rounded-md border border-divider bg-parchment-light p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow">Stress lens · storm-state margin</p>
          <h2 className="mt-1 font-display text-2xl italic text-ink">How much storm can it take?</h2>
        </div>
        <span className="rounded-full border border-divider bg-parchment px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
          span.rs parity engine
        </span>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        {/* ── Your live book under storm ─────────────────────────── */}
        <section className="rounded-md border border-divider bg-parchment p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted">Your live book</p>
          {wallet == null ? (
            <p className="mt-3 text-sm text-ink-soft">
              Connect a wallet and this panel stress-tests your real positions, escalating the
              SPAN scenario grid until your margin would breach your collateral.
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
              and watch how much market shock it can absorb before maintenance margin breaks.
            </p>
          ) : (
            <>
              <StormBars rows={liveStormRows} max={liveMax} fmt={(v) => formatUsd(v, 6)} />
              <p className="mt-3 text-[12.5px] leading-snug text-ink">
                {collateralRaw == null ? (
                  <span className="text-ink-soft">
                    Posted collateral is loading; the breach point appears once it reads.
                  </span>
                ) : breach ? (
                  <>
                    Your book breaches maintenance margin at a{' '}
                    <span className="font-mono text-neg">{breach.label.replace(/^\w+\s/, '')}</span>{' '}
                    adverse move. Vigil soft-liquidates before it goes underwater.
                  </>
                ) : (
                  <>
                    Your book absorbs a <span className="font-mono text-live">-35% crash</span> without breaching
                    your posted collateral. Netting is buying that survival room.
                  </>
                )}
              </p>
            </>
          )}
        </section>

        {/* ── Worked example: netted vs leg-by-leg under storm ────── */}
        <section className="rounded-md border border-divider bg-parchment p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider text-muted">Netted vs leg-by-leg</p>
            <span className="rounded-sm bg-ink/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ink-soft">
              worked example
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-soft">
            A hedged ETH-PERP pair (long HIP-3, short HIP-4), $100k each leg, as the market crashes.
          </p>
          <StormBars
            rows={STORMS.map((s, i) => ({ label: s.label, value: workedIsolated[i] }))}
            max={workedMax}
            fmt={(v) => `$${Number(v).toLocaleString('en-US')}`}
          />
          <p className="mt-3 font-mono text-sm text-ink">
            Under a crash, netting cuts margin <span className="text-xl text-live">{crashFreedPct}%</span>
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">
            Leg-by-leg needs <span className="font-mono">${Number(crashIsolated).toLocaleString('en-US')}</span>; the
            same book netted as one portfolio needs only{' '}
            <span className="font-mono text-live">${Number(crashHedged).toLocaleString('en-US')}</span>. The hedge
            is worth most exactly when the storm hits.
          </p>
        </section>
      </div>

      <p className="mt-4 rounded-md bg-parchment-soft/60 px-4 py-3 text-[11px] leading-snug text-ink-soft">
        Storm-state margin is computed client-side by the TypeScript parity port of Plinth&apos;s span.rs,
        the same scenario method the chain runs each block, evaluated at the storm magnitude (legs priced
        entry = mark, so this measures the shock&apos;s effect on margin structure, not unrealized PnL). There
        is no time-to-liquidation clock: testnet has no live marks or funding to decay from, so we show the
        honest thing, the shock that breaks margin, and that{' '}
        <Link href="/architecture" className="underline decoration-divider underline-offset-2 hover:text-ink">
          Vigil soft-liquidates
        </Link>{' '}
        before a book goes underwater.
      </p>
    </div>
  );
}
