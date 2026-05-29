import { SectionShell } from './section-shell';

export function PlinthSection() {
  return (
    <SectionShell
      eyebrow="Margin engine · Plinth"
      headline={
        <>
          Capital efficiency,
          <br className="hidden md:inline" /> mathematically.
        </>
      }
      sub="Plinth computes a SPAN-style cross-product margin number in Rust, deployed as Stylus. The same math costs 10–100× more gas in equivalent Solidity — which is why it has not shipped onchain elsewhere."
    >
      <div className="mx-auto grid max-w-4xl gap-3 text-center md:grid-cols-3">
        {/* Audit SSS-2 fix: copy claimed "14 SPAN scenarios" — but
            `contracts/plinth/src/span.rs:24-32` defines exactly 7 entries in
            `SCENARIOS_BPS` (`±10%, ±5%, ±2%, 0`). The landing-page number
            doubled the actual implementation. Now sourced to match the
            const array; sub line names the source so future drift between
            copy and code is loud. */}
        <Stat label="Gas vs Solidity" value="10–100×" sub="lower" />
        <Stat label="SPAN scenarios" value="7" sub="span.rs SCENARIOS_BPS" />
        <Stat label="Update latency" value="< 1 block" sub="on Arb Sepolia" />
      </div>
    </SectionShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-divider bg-parchment p-6">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-3 font-display text-4xl italic text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </div>
  );
}
