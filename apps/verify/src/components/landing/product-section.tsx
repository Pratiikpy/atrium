import { SectionShell } from './section-shell';
import { VENUES, VENUE_COUNT } from '@/lib/venues';

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const;

function numberWord(n: number): string {
  return COUNT_WORDS[n] ?? n.toString();
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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Impluvium diagram — the design's Roman atrium catchment metaphor. Renders
 * one circle per canonical venue from `@/lib/venues`. If VENUE_COUNT changes,
 * the layout recomputes; nothing here is hardcoded to "six" or "seven."
 */
function ImpluviumDiagram() {
  const venues = VENUES;
  const cx = 280;
  const cy = 200;
  const radius = 170;
  // arrange venues around a circle, evenly spaced
  const positioned = venues.map((v, i) => {
    const angle = (i / venues.length) * Math.PI * 2 - Math.PI / 2;
    return { ...v, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 560 400"
        className="mx-auto h-auto w-full max-w-3xl"
        role="img"
        aria-label={`Impluvium diagram showing the ${numberWord(venues.length)} Portico-whitelisted venues feeding into the Plinth margin engine`}
      >
        {positioned.map((v) => (
          <g key={v.id}>
            <line
              x1={v.x}
              y1={v.y}
              x2={cx}
              y2={cy}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-muted"
            />
            <circle
              cx={v.x}
              cy={v.y}
              r="22"
              fill="var(--color-parchment)"
              stroke="currentColor"
              strokeWidth="1"
              className="text-divider"
            />
            <text
              x={v.x}
              y={v.y + 4}
              textAnchor="middle"
              fontSize="10"
              fontFamily="Geist Mono, ui-monospace"
              className="fill-ink-soft"
            >
              {v.shortLabel}
            </text>
          </g>
        ))}
        <circle cx={cx} cy={cy} r="46" fill="var(--color-ink)" />
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize="11"
          fontFamily="Geist, system-ui"
          fill="var(--color-parchment)"
          letterSpacing="0.08em"
        >
          PLINTH
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontSize="9"
          fontFamily="Geist Mono, ui-monospace"
          fill="var(--color-dark-white-55)"
        >
          buying power
        </text>
      </svg>
    </div>
  );
}
