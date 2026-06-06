import { MarketingShell } from '@/components/atrium/MarketingShell';
import { buildMetadata } from '@/lib/build-metadata';

export const metadata = buildMetadata({
  title: 'Benchmarks',
  description: 'Side-by-side qualitative comparison against the closest comparables, checked against each protocol public docs and on-chain reads. Honest where Atrium loses.',
  canonical: '/benchmarks',
});

export default function BenchmarksPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-5xl text-ink">Benchmarks</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Side-by-side against the closest comparables. Each row is a qualitative check against each
        protocol&rsquo;s public docs and our own on-chain reads, not a head-to-head benchmark number.
        Where Atrium loses, we say so.
      </p>

      <section className="mt-12">
        <div className="grid gap-3 sm:hidden">
          {ROWS.map((row) => (
            <article key={row.dim} className="rounded-md border border-divider bg-parchment-soft/40 p-4">
              <p className="font-medium text-ink">{row.dim}</p>
              <dl className="mt-3 space-y-2 text-sm text-ink-soft">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted">Atrium</dt>
                  <dd className="mt-0.5 break-words">{row.a}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted">Cascade</dt>
                  <dd className="mt-0.5 break-words">{row.c}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted">August</dt>
                  <dd className="mt-0.5 break-words">{row.b}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[24%]" />
            <col className="w-[24%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-divider text-left text-muted">
              <th className="py-2.5 pr-6 font-normal">Dimension</th>
              <th className="py-2.5 pr-6 font-normal">Atrium</th>
              <th className="py-2.5 pr-6 font-normal">Cascade (Solana)</th>
              <th className="py-2.5 pr-6 font-normal">August (Solana)</th>
            </tr>
          </thead>
          <tbody className="text-ink-soft">
            {ROWS.map((row) => <Row key={row.dim} {...row} />)}
          </tbody>
        </table>
        </div>
      </section>

      <section className="mt-12 rounded-md border border-divider bg-parchment-soft/40 p-6">
        <p className="text-sm text-ink-soft">
          Honest read: the Solana-native comparables have UX polish and mainnet liveness Atrium does not yet match. Atrium leads on chain choice (EVM is larger), open standards, agent-layer depth, and formal verification. The polish gap closes as the app surfaces complete; the standards gap holds.
        </p>
      </section>
      </div>
    </MarketingShell>
  );
}

const ROWS = [
  { dim: 'Chain', a: 'Arbitrum + RH-Chain (when SDK)', c: 'Solana', b: 'Solana' },
  { dim: 'Margin compute', a: 'Stylus (Rust, ~10-100x cheaper compute-heavy ops, per Arbitrum Stylus)', c: 'Native Solana programs', b: 'N/A' },
  { dim: 'Open adapter standard', a: 'IPorticoAdapter v1.0 (MIT)', c: 'Closed', b: 'Closed' },
  { dim: 'Agent integration', a: 'Sigil EIP-712 + Postern session keys + ERC-8004', c: 'Limited', b: 'None' },
  { dim: 'Formal verification', a: '9 Kani proofs authored; CI lane Month 3', c: 'Audit only', b: 'Audit only' },
  { dim: 'UX polish today', a: 'Foundation: Verifier Mode complete, app surfaces in progress', c: 'More mature', b: 'More mature' },
  { dim: 'Mainnet live', a: 'No, testnet build phase', c: 'Yes', b: 'Yes' },
] as const;

function Row({ dim, a, c, b }: { dim: string; a: string; c: string; b: string }) {
  return (
    <tr className="border-b border-divider/60">
      <td className="py-3 pr-6 font-medium text-ink">{dim}</td>
      <td className="py-3 pr-6">{a}</td>
      <td className="py-3 pr-6">{c}</td>
      <td className="py-3 pr-6">{b}</td>
    </tr>
  );
}
