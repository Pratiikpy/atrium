import { SectionShell } from './section-shell';
import { VENUES, VENUE_COUNT } from '@/lib/venues';

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const;

function numberWord(n: number): string {
  return COUNT_WORDS[n] ?? n.toString();
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ProductSection() {
  const count = VENUE_COUNT;
  return (
    <SectionShell
      id="product"
      eyebrow="The product"
      headline={`${capitalize(numberWord(count))} live venues feed one buying-power number.`}
      sub="Plinth, the Stylus margin engine, reads collateral across every venue you hold positions in and computes a SPAN-style cross-product margin figure, live, on testnet."
    >
      <ImpluviumDiagram />
    </SectionShell>
  );
}

/**
 * Impluvium  the Roman atrium catchment metaphor. Canon layout from
 * desing/extracted/Atriumnew/index.html:929-1046 is a rectangular
 * catchment, NOT a radial wheel. Three rows:
 *   1. 4-col venue cards (Portico-whitelisted adapters across the top)
 *   2. 200px pool row (centered TVL figure, ink border, hatch background)
 *   3. leverage scale rule + 0x to 10x meter
 *
 * Wrapped in a draw-label header (Fig.01 . Capital convergence | Sheet
 * 02 / 08) and a draw-footer with the scale meter.
 *
 * Per-venue dollar amounts are not exposed by /api/protocol/metrics yet,
 * so the bars render as "pending". Pool figure stays as "pending" text
 * until the TVL number actually returns from Scribe and the page is
 * client-hydrated. For an SSR landing page the honest default is to
 * show pending; the verify app at /app/portfolio is the live surface.
 */
function ImpluviumDiagram() {
  const venues = VENUES.slice(0, 8); // Canon grid is 4-col; 7 venues fit in 2 rows with one empty cell.
  return (
    <div className="impluvium-block mx-auto max-w-4xl">
      {/* Draw label (top) */}
      <div className="flex items-start justify-between border-b border-ink pb-3.5 text-xs text-ink-soft">
        <div>
          <div className="font-medium text-ink">Fig. 01 . Capital convergence</div>
          <div className="mt-0.5 text-muted">Plan view . live testnet</div>
        </div>
        <div className="text-right">
          <div className="font-medium text-ink">Sheet 02 / {String(VENUE_COUNT + 1).padStart(2, '0')}</div>
          <div className="mt-0.5 text-muted">Atrium Labs . 2026</div>
        </div>
      </div>

      {/* Impluvium catchment */}
      <div
        className="relative mt-6 grid border border-ink bg-parchment-light p-8"
        style={{ gridTemplateRows: 'auto 200px auto', gap: '32px' }}
      >
        {/* Row 1: 4-col venue cards */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {venues.map((v) => (
            <VenueCard key={v.id} v={v} />
          ))}
          {/* Pad to a clean 8-cell grid so two rows align. */}
          {venues.length < 8 && Array.from({ length: 8 - venues.length }).map((_, i) => (
            <div key={`pad-${i}`} className="hidden sm:block" aria-hidden />
          ))}
        </div>

        {/* Row 2: centered pool */}
        <div className="relative flex items-center justify-center">
          <div
            className="relative flex w-[min(620px,90%)] flex-col items-center justify-center border border-ink bg-parchment"
            style={{ height: '100%' }}
          >
            <div className="absolute left-3.5 top-3 text-[9.5px] uppercase tracking-wider text-ink-soft">Pool</div>
            <div className="absolute right-3.5 top-3 text-[9.5px] uppercase tracking-wider text-ink-soft">Unified margin</div>
            <div className="absolute bottom-3 left-3.5 text-[9.5px] text-ink-soft">arb-sepolia</div>
            <div className="absolute bottom-3 right-3.5 inline-flex items-center text-[9.5px] uppercase tracking-wider text-ink-soft">
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[var(--color-live)]" />
              testnet
            </div>
            <div className="text-center">
              <div
                className="font-medium leading-none text-ink"
                style={{ fontSize: 'clamp(36px, 4.6vw, 56px)', letterSpacing: '-0.025em' }}
              >
                pending
              </div>
              <div className="mt-2 text-[10.5px] uppercase tracking-[0.14em] text-muted">
                buying power . live wire pending
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: scale rule + leverage control */}
        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-ink pt-4">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">
            Scale . 0x to 10x buying power
          </div>
          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="w-[260px]">
              <div className="mb-1.5 grid h-2 grid-cols-5">
                <span className="border-y border-l border-ink bg-ink" />
                <span className="border-y border-l border-ink" />
                <span className="border-y border-l border-ink bg-ink" />
                <span className="border-y border-l border-ink" />
                <span className="border border-ink bg-ink" />
              </div>
              <div className="flex justify-between text-[9.5px] text-muted">
                <span>0x</span><span>2x</span><span>4x</span><span>6x</span><span>10x</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Draw footer */}
      <div className="mt-4 flex items-start justify-between text-[10.5px] uppercase tracking-[0.14em] text-muted">
        <span>{VENUE_COUNT} Portico-whitelisted venues</span>
        <span>SPAN . cross-product . onchain</span>
      </div>
    </div>
  );
}

function VenueCard({ v }: { v: { id: string; shortLabel: string; label: string; kind: string } }) {
  const subtitle = kindLabel(v.kind);
  return (
    <div
      className="venue-card relative border border-line bg-parchment p-3.5 transition hover:-translate-y-0.5 hover:border-accent hover:bg-parchment-light"
      data-venue-slug={`adapter-${v.id}`}
    >
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">{v.shortLabel}</div>
      <div className="mt-1 text-[12px] text-ink-soft">{subtitle}</div>
      <div className="mt-3 text-[19px] leading-none tracking-[-0.012em] text-ink">pending</div>
      <div className="mt-2.5 h-[3px] overflow-hidden bg-parchment-soft">
        <div className="h-full w-0 bg-accent transition-[width,background] duration-500" />
      </div>
    </div>
  );
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'perp': return 'Tokenized perps';
    case 'cash-equiv': return 'RWA . USTB';
    case 'yield-bearing': return 'PT . stETH';
    case 'LP': return 'LP . 3pool';
    case 'equity-perp': return 'RFQ . dark pool';
    case 'binary': return 'Prediction markets';
    default: return kind;
  }
}
