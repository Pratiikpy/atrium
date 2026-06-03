import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'KYC Disclosure',
  description: 'How and when Atrium triggers KYC verification via Sumsub.',
};

export default function KycPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl space-y-8 text-ink-soft">
        <header>
          <h1 className="font-display text-5xl text-ink">KYC Disclosure</h1>
          <p className="mt-2 text-sm italic text-muted">Last updated: 2026-05-28</p>
        </header>

        <section>
          <h2 className="font-display text-2xl text-ink">When KYC is triggered</h2>
          <p className="mt-3">
            KYC is required only when you request an <strong>Edict tier upgrade</strong> to access
            jurisdiction-restricted venues (e.g. equity perps). Tier 0 (unrestricted venues) does
            not require KYC. You are never forced to complete KYC; it is opt-in only.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">What Sumsub collects</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Government-issued photo ID (passport, driver&apos;s license, or national ID)</li>
            <li>Selfie photograph for liveness verification</li>
            <li>Biometric data derived from the selfie (facial geometry for matching)</li>
            <li>Name, date of birth, nationality as extracted from the ID document</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Sumsub&apos;s role</h2>
          <p className="mt-3">
            <a href="https://sumsub.com" className="underline" target="_blank" rel="noreferrer">Sumsub</a>{' '}
            acts as a <strong>data processor</strong> on behalf of Atrium. They process your KYC
            documents solely for identity verification purposes. Their privacy policy:{' '}
            <a href="https://sumsub.com/privacy-notice/" className="underline" target="_blank" rel="noreferrer">
              sumsub.com/privacy-notice
            </a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Retention</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>KYC documents are retained per Sumsub&apos;s data retention policy.</li>
            <li>Atrium retains the verification result (pass/fail + tier level) for <strong>5 years</strong> per AML record-keeping obligations.</li>
            <li>The underlying documents (ID images, selfie) are stored by Sumsub, not by Atrium directly.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">If verification fails</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Your Edict tier remains at 0 (unrestricted venues only).</li>
            <li>Restricted venues remain unavailable.</li>
            <li>No penalty is applied; you may continue using tier-0 features normally.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Appeal mechanism</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Re-submit via the KYC flow with corrected documents.</li>
            <li>Request manual review by contacting{' '}
              <a href="mailto:privacy@useatrium.me" className="underline">privacy@useatrium.me</a>.
            </li>
            <li>Human escalation available: response within 30 days.</li>
          </ul>
        </section>

        <p className="text-sm text-muted">
          See also: <Link href="/legal/privacy" className="underline">Privacy Policy</Link> ·{' '}
          <Link href="/legal/sub-processors" className="underline">Sub-processors</Link>
        </p>
      </article>
    </MarketingShell>
  );
}
