import { SectionShell } from './section-shell';

export function ArchitectureSection() {
  return (
    <SectionShell
      eyebrow="Architecture"
      headline="Stylus for hot math. Solidity for the venue layer."
      sub="Risk math lives in Rust, deployed as Stylus. The venue layer lives in Solidity, on OpenZeppelin patterns. Chainlink CCIP is the messaging bus between chains."
    >
      <div className="mx-auto max-w-4xl">
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Stylus (Rust)" pieces={['Plinth · margin engine', 'Coffer · ERC-4626 vault', 'Sigil · mandate decoder', 'Vigil · liquidator']} />
          <Card title="Solidity" pieces={['Aqueduct CCIP', 'PorticoRegistry', 'PraetorTimelock', '6× venue adapters']} />
        </div>
        <p className="mt-6 text-center text-xs text-muted">All admin calls route through PraetorTimelock · 48-hour community veto window</p>
      </div>
    </SectionShell>
  );
}

function Card({ title, pieces }: { title: string; pieces: string[] }) {
  return (
    <div className="rounded-lg border border-divider bg-parchment p-6">
      <h3 className="font-mono text-xs uppercase tracking-wider text-muted">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-ink-soft">
        {pieces.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
