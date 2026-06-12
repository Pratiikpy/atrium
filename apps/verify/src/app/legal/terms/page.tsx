import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for Atrium Verifier Mode on Arbitrum Sepolia testnet.',
  alternates: { canonical: '/legal/terms' },
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl space-y-8 text-ink-soft">
        <header>
          <h1 className="font-display text-5xl text-ink">Terms of Service</h1>
          <p className="mt-2 text-sm italic text-muted">
            Last updated: 2026-05-28 · Effective immediately
          </p>
          <p className="mt-1 text-sm text-muted">
            Contact: <a href="mailto:legal@useatrium.me" className="underline">legal@useatrium.me</a>
          </p>
        </header>

        <aside className="rounded-md border border-[var(--color-status-amber)] bg-[var(--color-status-amber)]/5 p-4 text-sm text-ink-soft">
          <strong>Note:</strong> Atrium is testnet-first. These terms cover the current public
          testnet service. Material changes will be noted in{' '}
          <Link href="/changelog" className="underline">/changelog</Link>.
        </aside>

        <Section title="1. Service definition">
          <p>
            Atrium provides &ldquo;Verifier Mode&rdquo;, a web interface for interacting with
            testnet smart contracts deployed on Arbitrum Sepolia. Version 1 is <strong>testnet-only</strong>.
            No real funds are involved. Tokens used are testnet USDC with no monetary value.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>By using Atrium, you represent that:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>You are at least 18 years old (or the age of majority in your jurisdiction).</li>
            <li>You are not located in, or a resident of, an OFAC-sanctioned country (see Edict tier 0 excluded jurisdictions below).</li>
            <li>If accessing SEC-restricted features (equity perps via tier-gated venues), you are not a &ldquo;US person&rdquo; as defined by Regulation S.</li>
            <li>You provide your own internet connection, browser, and hardware.</li>
          </ul>
        </Section>

        <Section title="3. Acceptable use">
          <p>You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Use the service for fraud, money laundering, or sanctions evasion.</li>
            <li>Engage in automated scraping beyond published rate limits.</li>
            <li>Reverse-engineer paid Codex API endpoints.</li>
            <li>Harass, threaten, or abuse other users.</li>
            <li>Bypass jurisdiction tier checks enforced by the Edict contract.</li>
          </ul>
        </Section>

        <Section title="4. License">
          <p>
            Atrium source code is MIT-licensed (see <code className="font-mono text-ink">LICENSE</code>
            {' '}and <code className="font-mono text-ink">CONTRIBUTING.md</code>). The hosted service
            (verify-app, Codex API, Tablet API) is offered as-is under these Terms. Dependencies
            under <code className="font-mono text-ink">resources/</code> carry their own licenses.
          </p>
        </Section>

        <Section title="5. Disclaimers">
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
            WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
          </p>
          <p className="mt-2">
            We do not warrant that smart contracts are bug-free, that the service will be
            uninterrupted, or that testnet tokens will retain any value (they have none).
          </p>
        </Section>

        <Section title="6. Limitation of liability">
          <p>
            For the testnet period (v1), total aggregate liability is capped at <strong>$0 USD</strong>.
            No real funds are at risk. A production release would require separate terms and
            separate acceptance.
          </p>
        </Section>

        <Section title="7. Indemnification">
          <p>
            You agree to indemnify and hold harmless Atrium, its contributors, and affiliates from
            any claims, damages, or expenses arising from:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your misuse of the service.</li>
            <li>Off-chain trades you enter with third parties using information from Atrium.</li>
            <li>KYC violations or misrepresentation of jurisdiction status.</li>
          </ul>
        </Section>

        <Section title="8. Governing law">
          <p>
            These Terms are governed by the laws of the <strong>Cayman Islands</strong>, without
            regard to conflict-of-law principles.
          </p>
          <p className="mt-2 text-sm text-muted">
            Choice rationale: Cayman Islands selected for crypto-native regulatory clarity.
            This section will be updated if the applicable entity or jurisdiction changes.
          </p>
        </Section>

        <Section title="9. Dispute resolution">
          <p>
            Any dispute arising from these Terms shall be resolved by binding arbitration
            administered by the <strong>LCIA</strong> (London Court of International Arbitration).
            Arbitration seat: Grand Cayman, Cayman Islands. Language: English.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Class-action waiver:</strong> you agree to resolve disputes individually, not as part of a class or representative action.</li>
            <li><strong>IP carve-out:</strong> either party may seek injunctive relief in any court of competent jurisdiction for intellectual property disputes.</li>
          </ul>
        </Section>

        <Section title="10. Excluded jurisdictions">
          <p>
            The following jurisdictions are excluded (Edict tier 0), based on OFAC sanctions and
            regulatory restrictions:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>Cuba, Iran, North Korea, Syria, Crimea region</li>
            <li>Any jurisdiction added to the OFAC SDN list</li>
            <li>Additional restrictions per Edict contract: see live list on-chain</li>
          </ul>
        </Section>

        <Section title="11. Term and termination">
          <p>
            These Terms are effective until terminated. You may stop using the service at any time.
            We may suspend or terminate your access for breach of these Terms, with or without
            notice. On-chain data remains immutable regardless of termination.
          </p>
        </Section>

        <Section title="12. Severability and entire agreement">
          <p>
            If any provision is held unenforceable, the remaining provisions continue in full force.
            These Terms, together with the <Link href="/legal/privacy" className="underline">Privacy Policy</Link>,
            constitute the entire agreement between you and Atrium regarding the service.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions or concerns: <a href="mailto:legal@useatrium.me" className="underline">legal@useatrium.me</a>.
            Security disclosures: see <Link href="/security" className="underline">/security</Link>.
          </p>
        </Section>
      </article>
    </MarketingShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
