import Link from 'next/link';
import { AuditFindingsTable } from '@/components/security/audit-findings-table';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Security',
  description: 'Atrium security posture, disclosure policy, and audit-findings register.',
  openGraph: {
    title: 'Security · Atrium',
    description: 'Atrium security posture, disclosure policy, and audit-findings register.',
    images: ['/opengraph-image'],
  },
};

export default function SecurityPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-5xl text-ink">Security</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Atrium targets Arbitrum Sepolia testnet in Year 1. No user funds will be at real economic
        risk. Below is the security model we design to. Where live code differs, the gap is
        tracked openly in the audit findings register.
      </p>

      <section className="mt-12 space-y-6">
        <Block heading="Design intent">
          <ul className="space-y-2 text-ink-soft">
            <li>• Kani plus proptest invariants: 9 Kani proofs authored, 5 of 9 proptest invariants pass locally. Formal-verification CI lane lands Month 3.</li>
            <li>• Dual oracle (Chainlink + Pyth) with 50 bps tolerance and 60 s freshness on every Plinth price read.</li>
            <li>• 3-keeper redundancy with economic slashing.</li>
            <li>• Praetor 3-of-5 multisig plus 48-hour PraetorTimelock on every parameter change (the mainnet target; testnet admin today is a single deployer key).</li>
            <li>• ERC-7201 namespaced storage for safe upgrades.</li>
            <li>• Per-adapter per-block notional cap on Coffer.</li>
            <li>• Postern Kill Switch revokes every Sigil mandate plus every ERC-7715 session key in one batched tx.</li>
          </ul>
        </Block>

        <Block heading="Audit-findings register" id="audit-findings-register">
          <p className="text-ink-soft">
            A cross-cutting code review covering contracts, adapters,
            off-chain services, frontend, and honesty disclosures runs on
            every release cycle. Each row below names the file, the
            finding, and the resolution status. The table refreshes on
            every page load against the latest published audit register.
          </p>
          <div className="mt-5">
            <AuditFindingsTable />
          </div>
        </Block>

        <Block heading="Disclose a vulnerability">
          <p className="text-ink-soft">
            Email <a className="text-ink hover:underline" href="mailto:security@useatrium.me">security@useatrium.me</a>.
            We respond within 48 hours. Critical issues are triaged same-day. A PGP key will be
            published once generated; until then, open a private{' '}
            <a
              className="text-ink hover:underline"
              href="https://github.com/Pratiikpy/atrium/security/advisories/new"
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub Security Advisory
            </a>
            .
          </p>
        </Block>

        <Block heading="Bug bounty">
          <ul className="space-y-2 text-ink-soft">
            <li>• Year 1 testnet: bug bounty program standup pending. Interim disclosure via <a className="text-ink hover:underline" href="mailto:security@useatrium.me">security@useatrium.me</a>. Same-day triage.</li>
            <li>• Year 2 mainnet flip: formal Immunefi-style program live before the flip. Tier target set on board sign-off.</li>
          </ul>
        </Block>

        <Block heading="Honest disclosures">
          <p className="text-ink-soft">
            Three venues (Aave V3, Pyth equity feeds, Hyperliquid) are mocked or relayed on
            testnet because the real upstream is not on Sepolia. Plus interim states for admin
            (deployer EOA pending Safe ceremony) and liquidation (monitoring-only pending keeper
            stake). Each item named explicitly with mechanism + timeline at{' '}
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
