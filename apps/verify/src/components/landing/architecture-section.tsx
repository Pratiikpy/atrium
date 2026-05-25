import { SectionShell } from './section-shell';

/**
 * Architecture section. Canon at desing/extracted/Atriumnew/index.html:1327-1355:
 * a bordered stack of rows; each row is a 4-col grid (number / name /
 * chips of components / side meta). Renders the per-layer breakdown
 * with the visual rhythm of a technical spec sheet.
 */

interface ArchRow {
  num: string;
  name: string;
  intro: string;
  chips: string[];
  side: string;
}

const ROWS: ArchRow[] = [
  {
    num: '01',
    name: 'Stylus . Rust',
    intro: 'Risk math on hot path',
    chips: ['Plinth', 'Coffer', 'Sigil', 'Vigil', 'plinth-math', 'plinth-oracle'],
    side: 'cargo-stylus 0.10',
  },
  {
    num: '02',
    name: 'Solidity . venue layer',
    intro: 'OZ patterns, immutable adapters',
    chips: ['Aqueduct', 'PorticoRegistry', '7 venue adapters', 'LanternAttestor', 'MockAavePool'],
    side: 'sol 0.8.28 . via-ir',
  },
  {
    num: '03',
    name: 'Multisig + timelock',
    intro: 'Every admin call routed',
    chips: ['PraetorTimelock . 48h', 'Curator multisig 3-of-5', 'Emergency pause . instant'],
    side: 'OZ TimelockController',
  },
  {
    num: '04',
    name: 'Cross-chain',
    intro: 'Messaging bus, no custody',
    chips: ['Chainlink CCIP', 'LINK fees', 'seen-messages replay guard', 'expiry + claim-back'],
    side: 'CCIP v1.5',
  },
  {
    num: '05',
    name: 'Off-chain',
    intro: 'Indexer + APIs + keepers',
    chips: ['Scribe . subgraph', 'Codex . x402', 'vigil-keeper', '3 agent services'],
    side: 'Graph Studio + Vercel',
  },
];

export function ArchitectureSection() {
  return (
    <SectionShell
      eyebrow="Architecture"
      headline="Five layers. One contract surface."
      sub="Risk math lives in Rust as Stylus. The venue layer lives in Solidity on OpenZeppelin patterns. Chainlink CCIP is the messaging bus between chains. Every admin call routes through a 48-hour timelock."
    >
      <div className="mx-auto mt-16 max-w-5xl overflow-hidden rounded-2xl border border-divider bg-parchment-light">
        {ROWS.map((r, i) => (
          <div
            key={r.num}
            className={`grid items-center gap-4 px-5 py-5 md:gap-7 md:px-7 md:py-6 md:grid-cols-[60px_220px_minmax(0,1fr)_180px] ${
              i < ROWS.length - 1 ? 'border-b border-divider' : ''
            }`}
          >
            <div className="font-mono text-[14px] uppercase tracking-wider text-muted">{r.num}</div>
            <div>
              <div className="text-[18px] text-ink">{r.name}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-soft">{r.intro}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-divider bg-parchment px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-soft"
                >
                  {chip}
                </span>
              ))}
            </div>
            <div className="text-right font-mono text-[10.5px] uppercase tracking-wider text-muted">
              {r.side}
            </div>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-prose text-center text-xs text-muted">
        All admin calls route through PraetorTimelock . 48-hour community veto window
      </p>
    </SectionShell>
  );
}
