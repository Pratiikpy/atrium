import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { AuditFindingsTable } from '@/components/security/audit-findings-table';

export const metadata = {
  title: 'Security',
  description: 'Atrium security posture and responsible disclosure policy.',
  openGraph: {
    title: 'Security · Atrium',
    description: 'Atrium security posture and responsible disclosure policy.',
    images: ['/opengraph-image'],
  },
};

export default function SecurityPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-5xl text-ink">Security</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Atrium is testnet-first. The current deployment is intended for evaluation,
        integration testing, and responsible disclosure, not for production funds.
        This page summarizes the controls we operate and the disclosure channel for
        researchers.
      </p>

      <section className="mt-12 space-y-6">
        <Block id="audit-findings-register" heading="Audit findings register">
          <p className="text-ink-soft">
            A live register of security findings, triage status, and remediation
            progress. This is the reference surface for ongoing review and
            release gating.
          </p>
          <div className="mt-4">
            <AuditFindingsTable />
          </div>
        </Block>

        <Block heading="Protocol controls">
          <ul className="space-y-2 text-ink-soft">
            <li>• Kani and property tests cover the margin and mandate invariants used by the live testnet build.</li>
            <li>• Dual oracle design: Chainlink plus Pyth, tolerance checks, and freshness checks on Plinth price reads.</li>
            <li>• Admin on the live testnet stack is a single deployer key today; the 3-of-5 Safe behind a 48h PraetorTimelock is the documented pre-mainnet gate (code in the repo, not active on the live stack).</li>
            <li>• ERC-7201 namespaced storage for safe upgrades.</li>
            <li>• Per-adapter per-block notional cap on Coffer.</li>
            <li>• Kill Switch path for revoking active Sigil mandates from the connected owner wallet.</li>
          </ul>
        </Block>

        <Block heading="Review posture">
          <p className="text-ink-soft">
            Security review is continuous across contracts, adapters, services,
            and frontend surfaces. Public releases include source, tests, and
            deployment addresses so reviewers can reproduce claims against the
            chain. Material issues are fixed before they are represented as
            production-ready.
          </p>
        </Block>

        <Block heading="Disclose a vulnerability">
          <p className="text-ink-soft">
            Email <a className="text-ink hover:underline" href="mailto:security@useatrium.me">security@useatrium.me</a>.
            Include affected contracts or routes, reproduction steps, impact,
            and any transaction hashes. We acknowledge reports within 48 hours
            and prioritize issues by impact.
          </p>
        </Block>

        <Block heading="Bug bounty">
          <p className="text-ink-soft">
            Atrium accepts responsible disclosures during testnet. Any bounty
            terms, reward amounts, and formal scope will be published before a
            production program is opened. Until then, do not assume a guaranteed
            payout; report critical issues directly to{' '}
            <a className="text-ink hover:underline" href="mailto:security@useatrium.me">security@useatrium.me</a>.
          </p>
        </Block>

        <Block heading="Honest disclosures">
          <p className="text-ink-soft">
            Some testnet integrations are simulated, relayed, or gated when the
            upstream venue is not available on Sepolia. User-facing surfaces label
            those states directly so testnet behavior is never presented as
            production liquidity. Current disclosures are listed at{' '}
            <Link href="/docs/honesty" className="text-ink underline-offset-2 hover:underline">/docs/honesty</Link>.
          </p>
        </Block>
      </section>

      <Link
        href="/"
        className="mt-16 inline-block text-sm text-ink underline-offset-2 hover:underline"
      >
        Back to Atrium
      </Link>
      </div>
    </MarketingShell>
  );
}

function Block({
  heading,
  children,
  id,
}: {
  heading: string;
  children: React.ReactNode;
  /** Optional fragment anchor. See learn/page.tsx for the same pattern. */
  id?: string;
}) {
  return (
    <div id={id} className="min-w-0 overflow-hidden rounded-md border border-divider bg-parchment p-6 scroll-mt-24">
      <h2 className="font-display text-2xl text-ink">{heading}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
