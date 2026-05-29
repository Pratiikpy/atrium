import { MarketingShell } from '@/components/atrium/MarketingShell';
import { buildMetadata } from '@/lib/build-metadata';

export const metadata = buildMetadata({
  title: 'Benchmarks',
  description: 'Side-by-side comparison against closest comparables. Honest numbers from competitor docs and on-chain reads.',
  canonical: '/benchmarks',
});

export default function BenchmarksPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-5xl text-ink">Benchmarks</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Side-by-side against the closest comparables. Numbers come from competitor docs and on-chain reads.
        Where Atrium loses, we say so.
      </p>

      <section className="mt-12 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-divider text-left text-muted">
              <th className="py-3 pr-6 font-normal">Dimension</th>
              <th className="py-3 pr-6 font-normal">Atrium</th>
              <th className="py-3 pr-6 font-normal">Cascade (Solana)</th>
              <th className="py-3 pr-6 font-normal">August (Solana)</th>
            </tr>
          </thead>
          <tbody className="text-ink-soft">
            <Row dim="Chain" a="Arbitrum + RH-Chain (when SDK)" c="Solana" b="Solana" />
            <Row dim="Margin compute" a="Stylus (Rust, 10–100× cheaper for compute-heavy ops)" c="Native Solana programs" b="N/A" />
            <Row dim="Open adapter standard" a="IPorticoAdapter v1.0 (MIT)" c="Closed" b="Closed" />
            <Row dim="Agent integration" a="Sigil EIP-712 + Postern session keys + ERC-8004" c="Limited" b="None" />
            <Row dim="Formal verification" a="5 Kani+proptest invariants in CI" c="Audit only" b="Audit only" />
            <Row dim="UX polish today" a="Foundation — Verifier Mode complete, app surfaces in progress" c="More mature" b="More mature" />
            <Row dim="Mainnet live" a="No — testnet build phase" c="Yes" b="Yes" />
          </tbody>
        </table>
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
