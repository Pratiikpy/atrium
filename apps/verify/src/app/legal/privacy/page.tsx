import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { ResetConsentButton } from '@/components/reset-consent-button';

export const metadata = {
  title: 'Privacy Policy',
  description: 'GDPR and CCPA-compliant privacy policy for Atrium Verifier Mode.',
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl space-y-8 text-ink-soft">
        <header>
          <h1 className="font-display text-5xl text-ink">Privacy Policy</h1>
          <p className="mt-2 text-sm italic text-muted">
            Last updated: 2026-05-28 · Scope: the Atrium app at useatrium.me and its supporting APIs (Codex, Tablet)
          </p>
          <p className="mt-1 text-sm text-muted">
            Contact: <a href="mailto:privacy@useatrium.me" className="underline">privacy@useatrium.me</a>
          </p>
        </header>

        {/* Lawyer-review marker */}
        <aside className="rounded-md border border-[var(--color-status-amber)] bg-[var(--color-status-amber)]/5 p-4 text-sm text-ink-soft">
          <strong>Note:</strong> This document is a self-drafted GDPR/CCPA-compliant template.
          Lawyer review is scheduled pre-mainnet ($2–5K budget allocated). Until then, treat as
          best-effort compliance. Material changes will be noted in{' '}
          <Link href="/changelog" className="underline">/changelog</Link>.
        </aside>

        <Section title="1. Data controller">
          <p>
            The data controller is <strong>Atrium</strong> (entity registration pending;
            the Atrium project team operates as an unincorporated team until entity formation is
            complete; see <Link href="/team" className="underline">/team</Link> for individuals).
          </p>
          <p className="mt-2 text-sm text-muted">
            Limitation: no formal entity is registered as of this writing. This policy will be
            updated with the registered entity name and jurisdiction once incorporation completes.
          </p>
        </Section>

        <Section title="2. Lawful basis (GDPR Art. 6)">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Legitimate interest</strong>: analytics (SimpleAnalytics, aggregated, no personal IDs). You may opt out via the cookie consent banner.</li>
            <li><strong>Contract</strong>: service delivery (rendering your portfolio, executing transactions you initiate).</li>
            <li><strong>Consent</strong>: Sentry error replay, marketing communications (if any). Revocable at any time.</li>
            <li><strong>Vital interest / legal obligation</strong>: fraud prevention, AML record-keeping where KYC is triggered.</li>
          </ul>
        </Section>

        <Section title="3. Data categories collected">
          <ul className="list-disc space-y-1 pl-5">
            <li>Wallet addresses (pseudonymous, on-chain)</li>
            <li>IP addresses (Codex API logs, retained 24h)</li>
            <li>User-agent strings (Codex API logs)</li>
            <li>Device fingerprints (Sentry, only with consent)</li>
            <li>Error context: stack traces, breadcrumbs (Sentry, scrubbed of wallet addresses)</li>
            <li>KYC documents: government ID, selfie, biometric (Sumsub, only if user opts into tier upgrade)</li>
          </ul>
        </Section>

        <Section title="4. Retention schedule">
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-divider text-left text-muted">
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2">Retention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                <tr><td className="py-2 pr-4">Codex API logs</td><td>24 hours</td></tr>
                <tr><td className="py-2 pr-4">Sentry events</td><td>90 days</td></tr>
                <tr><td className="py-2 pr-4">SimpleAnalytics aggregated data</td><td>Indefinite (no individual records)</td></tr>
                <tr><td className="py-2 pr-4">KYC documents</td><td>Per Sumsub policy + 5 years AML record-keeping</td></tr>
                <tr><td className="py-2 pr-4">Wallet activity logs</td><td>Indefinite (on-chain, immutable)</td></tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="5. Third-party processors (sub-processors)">
          <p>
            Full details at <Link href="/legal/sub-processors" className="underline">/legal/sub-processors</Link>.
            Summary:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li><a href="https://vercel.com/legal/privacy-policy" className="underline" target="_blank" rel="noreferrer">Vercel</a>: hosting</li>
            <li><a href="https://www.cloudflare.com/privacypolicy/" className="underline" target="_blank" rel="noreferrer">Cloudflare</a>: DNS, DDoS protection</li>
            <li><a href="https://sentry.io/privacy/" className="underline" target="_blank" rel="noreferrer">Sentry</a>: error monitoring (consent-gated)</li>
            <li><a href="https://simpleanalytics.com/privacy-policy" className="underline" target="_blank" rel="noreferrer">SimpleAnalytics</a>: analytics (EU-based, GDPR-friendly)</li>
            <li><a href="https://sumsub.com/privacy-notice/" className="underline" target="_blank" rel="noreferrer">Sumsub</a>: KYC (only if user opts in)</li>
            <li><a href="https://www.doppler.com/legal/privacy-policy" className="underline" target="_blank" rel="noreferrer">Doppler</a>: secrets management (no user PII)</li>
            <li><a href="https://www.digitalocean.com/legal/privacy-policy" className="underline" target="_blank" rel="noreferrer">DigitalOcean</a>: daemon hosting (no user PII)</li>
            <li><a href="https://thegraph.com/privacy/" className="underline" target="_blank" rel="noreferrer">The Graph</a>: subgraph indexer (public chain data only)</li>
            <li><a href="https://web3.storage/terms/" className="underline" target="_blank" rel="noreferrer">Web3.storage</a>: IPFS pinning (public Merkle roots only)</li>
          </ul>
        </Section>

        <Section title="6. Your rights (GDPR Art. 15–22 + CCPA §1798.100)">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Access</strong>: request a copy of data we hold about you.</li>
            <li><strong>Rectification</strong>: correct inaccurate data.</li>
            <li><strong>Erasure</strong>: request deletion. Note: on-chain data is immutable; we erase off-chain mirrors only.</li>
            <li><strong>Portability</strong>: receive your data in a structured, machine-readable format.</li>
            <li><strong>Objection</strong>: object to processing based on legitimate interest.</li>
            <li><strong>Restriction</strong>: request we limit processing.</li>
            <li><strong>Right to lodge complaint</strong>: with your supervisory authority (e.g. ICO, CNIL, BfDI).</li>
            <li><strong>California-specific</strong>: do not sell my personal information. We do not sell personal information.</li>
          </ul>
        </Section>

        <Section title="7. How to exercise your rights">
          <p>
            Email <a href="mailto:privacy@useatrium.me" className="underline">privacy@useatrium.me</a> with
            your wallet address and request. We respond within <strong>30 calendar days</strong>.
          </p>
          <p className="mt-2 text-sm text-muted">
            A self-service data request form is planned at /legal/data-request.
          </p>
        </Section>

        <Section title="8. International transfers">
          <p>
            Vercel and DigitalOcean process data in the United States. For EU→US transfers, we
            rely on Standard Contractual Clauses (SCCs) as published by each processor.
          </p>
          <p className="mt-2 text-sm text-muted">
            Limitation: we have not independently verified each processor{"'"}s SCC implementation.
            This will be confirmed during lawyer review.
          </p>
        </Section>

        <Section title="9. KYC disclosure">
          <p>
            When you request a tier upgrade for restricted venues, KYC is processed by Sumsub.
            See <Link href="/legal/kyc" className="underline">/legal/kyc</Link> for full details
            on what is collected, retention, and appeal mechanisms.
          </p>
        </Section>

        <Section title="10. Cookies and tracking technologies">
          <p>We use the following:</p>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-divider text-left text-muted">
                  <th className="pb-2 pr-4">Name / Tech</th>
                  <th className="pb-2 pr-4">Purpose</th>
                  <th className="pb-2">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                <tr><td className="py-2 pr-4 font-mono text-xs">atrium_consent_v1</td><td className="pr-4">Stores consent preferences</td><td>Essential</td></tr>
                <tr><td className="py-2 pr-4 font-mono text-xs">atrium_consent_ts</td><td className="pr-4">Consent timestamp (12-month expiry)</td><td>Essential</td></tr>
                <tr><td className="py-2 pr-4 font-mono text-xs">atrium_session</td><td className="pr-4">SIWE auth session</td><td>Essential</td></tr>
                <tr><td className="py-2 pr-4 font-mono text-xs">SimpleAnalytics script</td><td className="pr-4">Privacy-friendly page views (no cookies set)</td><td>Analytics</td></tr>
                <tr><td className="py-2 pr-4 font-mono text-xs">Sentry SDK</td><td className="pr-4">Error capture + session replay</td><td>Analytics (consent-gated)</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm">
            Manage your preferences via the cookie consent banner or{' '}
            <ResetConsentButton />.
          </p>
        </Section>

        <Section title="11. Children">
          <p>
            Atrium is not intended for persons under 18 years of age. We do not knowingly collect
            data from minors. If we become aware that a user is under 18, we will terminate access
            and delete associated off-chain data.
          </p>
        </Section>

        <Section title="12. Changes to this policy">
          <p>
            Material changes are announced with 30 days{"'"} notice via{' '}
            <Link href="/changelog" className="underline">/changelog</Link> and emailed to users
            who have provided an email address. Continued use after the notice period constitutes
            acceptance.
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
