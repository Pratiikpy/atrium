import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Sub-processors',
  description: 'List of third-party sub-processors that handle data on behalf of Atrium.',
};

const PROCESSORS = [
  { name: 'Vercel', url: 'https://vercel.com', purpose: 'Frontend hosting, edge functions', data: 'IP addresses, request metadata', location: 'United States (global edge)', dpa: 'https://vercel.com/legal/dpa' },
  { name: 'Cloudflare', url: 'https://cloudflare.com', purpose: 'DNS, DDoS protection, email routing', data: 'IP addresses, request metadata', location: 'United States (global edge)', dpa: 'https://www.cloudflare.com/cloudflare-customer-dpa/' },
  { name: 'Sentry', url: 'https://sentry.io', purpose: 'Error monitoring, session replay (consent-gated)', data: 'Error context, device fingerprints, scrubbed stack traces', location: 'United States', dpa: 'https://sentry.io/legal/dpa/' },
  { name: 'SimpleAnalytics', url: 'https://simpleanalytics.com', purpose: 'Privacy-friendly page analytics', data: 'Aggregated page views (no individual records, no cookies)', location: 'Netherlands, EU', dpa: 'https://simpleanalytics.com/dpa' },
  { name: 'Sumsub', url: 'https://sumsub.com', purpose: 'KYC identity verification (opt-in only)', data: 'Government ID, selfie, biometric data', location: 'United Kingdom / EU', dpa: 'https://sumsub.com/dpa/' },
  { name: 'Doppler', url: 'https://doppler.com', purpose: 'Secrets management', data: 'No user PII, internal secrets only', location: 'United States', dpa: 'https://www.doppler.com/legal/dpa' },
  { name: 'DigitalOcean', url: 'https://digitalocean.com', purpose: 'Daemon hosting (vigil-keeper, lantern-attestor)', data: 'No user PII, service-to-service only', location: 'United States', dpa: 'https://www.digitalocean.com/legal/data-processing-agreement' },
  { name: 'The Graph', url: 'https://thegraph.com', purpose: 'Subgraph indexer (Scribe)', data: 'Public on-chain data only (no PII)', location: 'Decentralized', dpa: null },
  { name: 'Web3.storage', url: 'https://web3.storage', purpose: 'IPFS pinning for Lantern Merkle roots', data: 'Public Merkle roots only (no PII)', location: 'United States', dpa: null },
] as const;

export default function SubProcessorsPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-4xl space-y-8 text-ink-soft">
        <header>
          <h1 className="font-display text-5xl text-ink">Sub-processors</h1>
          <p className="mt-2 text-sm italic text-muted">Last updated: 2026-05-28</p>
          <p className="mt-2">
            Third-party services that process data on behalf of Atrium. Changes to this list
            are published in <Link href="/changelog" className="underline">/changelog</Link>.
          </p>
        </header>

        <div className="grid gap-3 sm:hidden">
          {PROCESSORS.map((p) => (
            <article key={p.name} className="rounded-md border border-divider bg-parchment-soft/40 p-4">
              <a href={p.url} className="font-medium text-ink underline" target="_blank" rel="noreferrer">{p.name}</a>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted">Purpose</dt>
                  <dd className="mt-0.5 break-words">{p.purpose}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted">Data shared</dt>
                  <dd className="mt-0.5 break-words text-xs">{p.data}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted">Location</dt>
                  <dd className="mt-0.5 break-words text-xs">{p.location}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs">
                {p.dpa ? (
                  <a href={p.dpa} className="underline" target="_blank" rel="noreferrer">View DPA</a>
                ) : (
                  <span className="text-muted">DPA: N/A</span>
                )}
              </p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider text-left text-muted">
                <th className="pb-2 pr-4">Service</th>
                <th className="pb-2 pr-4">Purpose</th>
                <th className="pb-2 pr-4">Data shared</th>
                <th className="pb-2 pr-4">Location</th>
                <th className="pb-2">DPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {PROCESSORS.map((p) => (
                <tr key={p.name}>
                  <td className="py-3 pr-4 font-medium text-ink">
                    <a href={p.url} className="underline" target="_blank" rel="noreferrer">{p.name}</a>
                  </td>
                  <td className="py-3 pr-4">{p.purpose}</td>
                  <td className="py-3 pr-4 text-xs">{p.data}</td>
                  <td className="py-3 pr-4 text-xs">{p.location}</td>
                  <td className="py-3 text-xs">
                    {p.dpa ? (
                      <a href={p.dpa} className="underline" target="_blank" rel="noreferrer">View</a>
                    ) : (
                      <span className="text-muted">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted">
          See also: <Link href="/legal/privacy" className="underline">Privacy Policy</Link> ·{' '}
          <Link href="/legal/kyc" className="underline">KYC Disclosure</Link>
        </p>
      </article>
    </MarketingShell>
  );
}
