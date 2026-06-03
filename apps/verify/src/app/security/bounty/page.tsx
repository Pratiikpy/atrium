import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Bug Bounty',
  description: 'Atrium bug bounty program scope, severity matrix, and disclosure process.',
};

export default function BountyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl space-y-8 text-ink-soft">
        <header>
          <h1 className="font-display text-5xl text-ink">Bug Bounty Program</h1>
          <p className="mt-2 text-sm italic text-muted">Last updated: 2026-05-28</p>
        </header>

        <section>
          <h2 className="font-display text-2xl text-ink">In scope</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Testnet contracts on Arbitrum Sepolia:
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm font-mono">
                <li>Plinth (margin engine)</li>
                <li>Vigil (liquidation engine)</li>
                <li>Coffer (ERC-4626 vault)</li>
                <li>Sigil (agent mandates)</li>
                <li>Aqueduct, Postern, Portico, Edict, Praetor</li>
              </ul>
            </li>
            <li>Verify-app at <code className="font-mono text-ink">verify.useatrium.me</code></li>
            <li>Codex API at <code className="font-mono text-ink">codex.useatrium.me</code></li>
            <li>Tablet API at <code className="font-mono text-ink">tablet.useatrium.me</code> (when behind auth)</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Out of scope</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Front-end UI bugs without security impact</li>
            <li>Social engineering attacks</li>
            <li>Third-party services (Vercel, Cloudflare, Sentry)</li>
            <li>Theoretical risks already documented in <code className="font-mono text-ink">audits/</code></li>
            <li>Dependencies under <code className="font-mono text-ink">resources/</code> (report upstream)</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Severity matrix</h2>
          <p className="mt-3 text-sm text-muted">Aligned with Immunefi severity classification.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider text-left text-muted">
                  <th className="pb-2 pr-4">Severity</th>
                  <th className="pb-2 pr-4">Examples</th>
                  <th className="pb-2">Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                <tr>
                  <td className="py-2 pr-4 font-medium text-red-600">Critical</td>
                  <td className="py-2 pr-4">Fund loss, unauthorized admin access, contract takeover</td>
                  <td className="py-2">$5,000 – $25,000</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-orange-600">High</td>
                  <td className="py-2 pr-4">Funds at risk (partial), privilege escalation</td>
                  <td className="py-2">$1,000 – $5,000</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-yellow-600">Medium</td>
                  <td className="py-2 pr-4">Information disclosure, denial of service</td>
                  <td className="py-2">$250 – $1,000</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-muted">Low / Info</td>
                  <td className="py-2 pr-4">Best-practice violations, minor info leaks</td>
                  <td className="py-2">Swag + hall-of-fame credit</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Funding</h2>
          <p className="mt-3">
            Bounty payments are funded from the Praetor treasury post-mainnet. During testnet,
            rewards are <strong>best-effort by the founding team</strong> with public{' '}
            <Link href="/security/hall-of-fame" className="underline">hall-of-fame</Link> credit
            and swag for all valid disclosures.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Disclosure process</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li><strong>90-day responsible disclosure window.</strong></li>
            <li>Report to <a href="mailto:security@useatrium.me" className="underline">security@useatrium.me</a>.</li>
            <li>PGP encryption optional. See <code className="font-mono text-ink">runbooks/pgp-key-generation.md</code>.</li>
            <li>We acknowledge within 48 hours. Critical issues triaged same-day.</li>
            <li>Do not publicly disclose until the 90-day window expires or we publish a fix.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Hall of fame</h2>
          <p className="mt-3">
            Researchers who responsibly disclose are credited at{' '}
            <Link href="/security/hall-of-fame" className="underline">/security/hall-of-fame</Link>.
          </p>
        </section>
      </article>
    </MarketingShell>
  );
}
