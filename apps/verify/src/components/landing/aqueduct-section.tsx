import { SectionShell } from './section-shell';

export function AqueductSection() {
  return (
    <SectionShell
      id="bridge"
      eyebrow="Aqueduct · Chainlink CCIP"
      headline={
        <>
          Move collateral between chains in one{' '}
          <span
            className="italic"
            style={{
              fontFamily: '"Instrument Serif", "Times New Roman", serif',
              color: '#7E2A20',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            transaction.
          </span>
        </>
      }
      sub="Aqueduct routes assets through Chainlink CCIP. Collateral posted on a destination chain becomes Plinth credit on Arbitrum in 7–12 seconds on testnet. Robinhood Chain support lands once the upstream SDK publishes."
    >
      <ChainFlowDiagram />
    </SectionShell>
  );
}

function ChainFlowDiagram() {
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-divider bg-parchment-light p-8">
      <div className="flex items-center justify-between gap-4">
        <ChainNode label="ARB · Arbitrum Sepolia" sub="Plinth · margin engine" />
        <Arrow />
        <ChainNode label="RHC · Robinhood Chain" sub="Aqueduct receiver" />
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        CCIP message · LINK fees · replay-safe nonces · 48h timelock on bridge admin
      </p>
    </div>
  );
}

function ChainNode({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex-1 rounded-md border border-divider bg-parchment p-4 text-center">
      <p className="font-mono text-xs text-ink">{label}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">{sub}</p>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="48" height="20" viewBox="0 0 48 20" fill="none" stroke="currentColor" strokeWidth="1" className="shrink-0 text-muted">
      <path d="M0 10h44M40 5l6 5-6 5" />
    </svg>
  );
}
