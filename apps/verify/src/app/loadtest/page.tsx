import { LoadtestDashboard } from '@/components/loadtest-dashboard';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Loadtest',
  description: 'Live latency + gas measurements against testnet contracts. P50, P95, P99.',
  // Internal ops surface: keep out of search + link previews (defense in depth
  // beyond the robots.txt disallow, which crawlers may ignore).
  robots: { index: false, follow: false },
};

export default function LoadtestPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-5xl text-ink">Loadtest</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Public latency + gas measurements. The continuous load generator that hits every Atrium
        contract at 1, 10, and 100 tx/s starts in Phase 9 of the launch roadmap; the figures below
        are the baseline runs captured so far. Reproduction script lives in
        <code className="ml-1 font-mono text-ink">services/loadtest/</code>.
      </p>

      <LoadtestDashboard />

      <section className="mt-16 rounded-md border border-divider bg-parchment-soft/40 p-6">
        <h2 className="font-display text-2xl text-ink">SLOs (Year-1 testnet)</h2>
        <ul className="mt-3 space-y-2 text-ink-soft">
          <li>• <code className="font-mono">Plinth.update_margin</code>, ≤ 80K gas P95</li>
          <li>• <code className="font-mono">Plinth.open_position</code> (5 existing positions), ≤ 120K gas P95</li>
          <li>• Codex API, ≤ 200ms P95</li>
          <li>• Scribe indexer lag, ≤ 30s normal</li>
          <li>• Verifier Mode time-to-interactive, ≤ 1.5s on broadband</li>
          <li>• Lantern attestation cadence, about every 45 min</li>
        </ul>
      </section>
      </div>
    </MarketingShell>
  );
}
