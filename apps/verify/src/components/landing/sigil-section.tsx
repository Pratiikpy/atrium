import { SectionShell } from './section-shell';

export function SigilSection() {
  return (
    <SectionShell
      id="agents"
      variant="dark"
      eyebrow="Agent mandates · Sigil"
      headline={
        <>
          Agents trade with bounded{' '}
          <span
            className="font-serif italic"
            style={{
              color: '#C46A5E',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            mandates.
          </span>
        </>
      }
      sub="You sign one Intent Sigil, an EIP-712 mandate authorising one agent, for one strategy, for a finite window. Postern issues a session key. Your master key never moves."
    >
      <MandateCard />
    </SectionShell>
  );
}

function MandateCard() {
  // Audit P-9 fix: card uses `--color-dark-bg` (rgb(16,16,16)) so it matches
  // the section ground exactly. Previously this used `bg-ink-darkest`
  // (oklch(0.11 0.008 60)) which is ~rgb(28,25,23) — visibly lighter than
  // the section, so the card looked like it floated on a slightly darker
  // canvas. Both surfaces now share the same flat slab.
  // We also use a subtle border-soft outline so the card is still legible.
  return (
    <div
      className="mx-auto max-w-2xl rounded-xl border border-dark-white-24 p-6 text-sm"
      style={{ background: 'var(--color-dark-bg)' }}
    >
      <header className="flex items-baseline justify-between text-dark-white-55">
        <p className="text-[10px] uppercase tracking-wider">
          Intent Sigil · EIP-712
          {/* Phase theta.4 (2026-05-25): mandate shown is illustrative, not the
              viewer's actual mandate. Pre-fix, users could mistake the static
              `0xdelphi.eth` row for their own session. */}
          <span className="ml-2 rounded-sm bg-parchment/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-parchment/80">
            example
          </span>
        </p>
        <p className="font-mono text-[10px]">0xdelphi.eth</p>
      </header>
      <ul className="mt-5 space-y-2 font-mono text-[12px]">
        <Row label="agent" value="0xdelphi.eth" />
        <Row label="strategy" value="volatility arbitrage" />
        <Row label="per-action cap" value="50 USDC" />
        <Row label="daily cap" value="500 USDC" />
        <Row label="venues" value="HL · Pendle · Aave" />
        <Row label="expires" value="14 days" />
      </ul>
      <div className="mt-6 flex gap-3">
        <a
          href="/app/agents"
          className="rounded-md bg-parchment px-4 py-2 text-xs font-medium text-ink hover:bg-parchment-light"
        >
          + New mandate
        </a>
        <a
          href="/verify/7"
          className="rounded-md border border-dark-white-24 px-4 py-2 text-xs text-dark-white-55 hover:text-dark-fg"
        >
          Kill switch · revoke all
        </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between border-b border-dark-white-24 pb-1 text-dark-white-55 last:border-0">
      <span>{label}</span>
      <span className="text-dark-fg">{value}</span>
    </li>
  );
}
