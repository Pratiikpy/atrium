import { LiveQuote } from './live-quote';

/**
 * The Jamie hook, opening of the demo runbook per PRD §26.1 line 0:00–0:30.
 *
 * Both numbers (today's isolated margin AND the Atrium-netted margin) read
 * from the most recent on-chain ResearchAttestation. If the attestation has
 * not been published yet, both panels show placeholders that label themselves
 * as such, no hardcoded numbers presented as fact (audit D-26 fix).
 */
export function JamieHook() {
  return (
    <section className="mt-24 rounded-xl border border-divider bg-parchment-soft/40 p-8 sm:p-12">
      <p className="text-sm uppercase tracking-wide text-muted">Real trader · day-1 persona</p>
      <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
        Jamie holds positions across multiple onchain venues.
      </h2>
      <p className="mt-4 text-ink-soft">
        Concrete persona: a trader with $500K–$5M open on Hyperliquid HIP-3 perps who also holds Aave
        Horizon T-bills as a cash equivalent. Today the venues do not see each other; collateral
        gets posted twice. Atrium nets the hedge with one margin number.
      </p>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div className="rounded-md border border-divider bg-parchment p-6">
          <p className="text-xs uppercase tracking-wider text-muted">Today, isolated margin</p>
          <p className="mt-3 font-display text-5xl text-ink">
            <LiveQuote sourceLabel="ResearchAttestation: backtest input" placeholder="pending backtest" mode="baseline" />
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Posted twice because the venues do not see each other.
          </p>
        </div>
        <div className="rounded-md border border-divider bg-parchment p-6 ring-1 ring-accent/20">
          <p className="text-xs uppercase tracking-wider text-accent">With Atrium</p>
          <p className="mt-3 font-display text-5xl text-ink">
            <LiveQuote sourceLabel="ResearchAttestation: backtest result" placeholder="pending backtest" mode="atrium" />
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            One unified margin account. SPAN nets the hedge.
          </p>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted">
        Numbers source from the on-chain ResearchAttestation feed. Until the Q1-2026 backtest
        publishes (target per the launch roadmap (Phase 6)) both
        panels show "pending backtest" rather than invented numbers.
      </p>
    </section>
  );
}
