import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Responsible Disclosure',
  description: 'Atrium responsible disclosure scope and reporting process.',
};

export default function BountyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl space-y-8 text-ink-soft">
        <header>
          <h1 className="font-display text-5xl text-ink">Responsible Disclosure</h1>
          <p className="mt-2 text-sm italic text-muted">Last updated: 2026-06-09</p>
          <p className="mt-4">
            Atrium accepts vulnerability reports for the public testnet deployment.
            A formal bounty program, including reward terms and legal scope, will
            be published separately before it opens.
          </p>
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
            <li>Atrium app at <code className="font-mono text-ink">useatrium.me</code></li>
            <li>Codex API at <code className="font-mono text-ink">atrium-codex.prtk8899.workers.dev</code> (live)</li>
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
          <h2 className="font-display text-2xl text-ink">Priority</h2>
          <p className="mt-3 text-sm text-muted">
            Reports are prioritized by impact, exploitability, affected surface,
            and quality of reproduction.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li><strong>Critical:</strong> fund loss, unauthorized admin action, contract takeover.</li>
            <li><strong>High:</strong> privilege escalation, incorrect accounting, exploitable denial of service.</li>
            <li><strong>Medium:</strong> information disclosure, bypassable limits, user-impacting security flaws.</li>
            <li><strong>Low:</strong> hardening issues and best-practice gaps without direct exploitability.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Disclosure process</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li><strong>90-day responsible disclosure window.</strong></li>
            <li>Report to <a href="mailto:security@useatrium.me" className="underline">security@useatrium.me</a>.</li>
            <li>Include steps to reproduce, affected route or contract, impact, and any transaction hashes.</li>
            <li>We acknowledge within 48 hours and prioritize by severity.</li>
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
