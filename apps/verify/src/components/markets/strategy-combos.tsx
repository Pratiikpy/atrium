import Link from 'next/link';

/**
 * Starter strategies (BUILD_PLAN Phase 1, item 8): turn the venue catalog
 * into a benefit. Each combo pairs two LIVE (non-scaffold) venues and shows
 * the cross-margin story concretely - one deposit doing two jobs, or two
 * legs sharing one netted margin account.
 *
 * Honesty contract (.claude/rules/writing.md + CLAUDE.md "no fake numbers"):
 * the per-leg haircuts are the real published risk weights (same values as
 * the venue cards on this page). The dollar figures are a *worked example*
 * at a fixed $100K notional - transparent arithmetic, explicitly labelled
 * illustrative, exactly like the landing hero band. The user's real,
 * personalized requirement is computed live by Plinth on /app/trade
 * (GET /api/trade/margin-impact). We never present the example as truth and
 * we never invent the netted figure - we state only what netting guarantees
 * (it can only reduce the requirement) and send the user to the live number.
 */

interface Leg {
  venue: string;
  instrument: string;
  /** Real published initial-margin haircut, in percent. Matches the venue cards. */
  haircutPct: number;
  /** Notional in the $100K worked example. */
  exampleNotionalUsd: number;
  role: string;
}

interface Combo {
  id: string;
  name: string;
  tag: string;
  thesis: string;
  legs: Leg[];
  /** The cross-margin benefit for THIS combo, in one honest sentence. */
  benefit: string;
}

const COMBOS: Combo[] = [
  {
    id: 'carry',
    name: 'Collateral that earns',
    tag: 'Carry + perp',
    thesis:
      'Park collateral in tokenized T-bills and use the same balance to margin a perp. The cash does two jobs at once.',
    legs: [
      {
        venue: 'Aave Horizon',
        instrument: 'USTB (tokenized T-bill)',
        haircutPct: 1,
        exampleNotionalUsd: 100_000,
        role: 'Earns yield · counts as collateral',
      },
      {
        venue: 'Hyperliquid',
        instrument: 'ETH-PERP',
        haircutPct: 10,
        exampleNotionalUsd: 100_000,
        role: 'Directional perp · needs initial margin',
      },
    ],
    benefit:
      'Your T-bill keeps earning while it backs the perp. Without unified margin you would post the perp margin as a second, idle balance.',
  },
  {
    id: 'book',
    name: 'Diversified book',
    tag: 'Two-leg perp',
    thesis:
      'Run a crypto perp and an equity perp under one margin account. Partially offsetting risk nets in Plinth instead of stacking.',
    legs: [
      {
        venue: 'Hyperliquid',
        instrument: 'ETH-PERP',
        haircutPct: 10,
        exampleNotionalUsd: 100_000,
        role: 'CRYPTO_PERP correlation class',
      },
      {
        venue: 'Trade.xyz',
        instrument: 'NVDA-PERP',
        haircutPct: 15,
        exampleNotionalUsd: 100_000,
        role: 'EQUITY_PERP correlation class',
      },
    ],
    benefit:
      'Each venue alone demands its full initial margin. Plinth nets the two correlation classes in its SPAN matrix, so the pooled requirement is lower - never higher.',
  },
];

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
        <Link
          href="/app/trade"
          className="text-sm text-ink underline-offset-2 hover:underline"
        >
          Open the live margin compare on Trade
        </Link>
      </div>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">
        Cross-margin means a single deposit backs positions across venues instead of re-posting at
        each. Below: how that plays out for two live combos. Dollar figures are an illustrative
        worked example at a $100K notional using the published haircuts; your real number computes
        live from Plinth on the trade screen.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {COMBOS.map((c) => {
          const siloed = c.legs.reduce(
            (sum, l) => sum + (l.exampleNotionalUsd * l.haircutPct) / 100,
            0,
          );
          return (
            <article key={c.id} className="rounded-md border border-divider bg-parchment p-6">
              <header className="flex items-baseline justify-between gap-3">
                <p className="font-display text-xl text-ink">{c.name}</p>
                <span className="rounded-full border border-divider px-3 py-1 text-[11px] uppercase tracking-wider text-muted">
                  {c.tag}
                </span>
              </header>
              <p className="mt-2 text-sm text-ink-soft">{c.thesis}</p>

              <div className="mt-4 space-y-2">
                {c.legs.map((l) => (
                  <div
                    key={l.venue + l.instrument}
                    className="rounded-md border border-divider/60 bg-parchment-soft/40 px-4 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-ink">
                        {l.venue} · <span className="font-mono text-xs">{l.instrument}</span>
                      </p>
                      <p className="font-mono text-xs text-muted">{l.haircutPct}% haircut</p>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{l.role}</p>
                  </div>
                ))}
              </div>

              {/* Worked example - explicitly illustrative, arithmetic shown. */}
              <div className="mt-4 rounded-md bg-parchment-soft/60 px-4 py-3 text-[12px]">
                <p className="text-[10px] uppercase tracking-wider text-muted">
                  Illustrative · $100K per leg · published haircuts
                </p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-ink-soft">Each venue siloed (sum of legs)</span>
                  <span className="font-mono text-ink">${fmtUsd(siloed)}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-ink-soft">Atrium (one pool, Plinth-netted)</span>
                  <span className="font-mono text-live">≤ ${fmtUsd(siloed)}</span>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-muted">{c.benefit}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
