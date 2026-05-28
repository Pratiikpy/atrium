import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Atrium · Privacy',
  description: 'Privacy policy. Year-1 testnet, no PII, on-chain pseudonymous identity.',
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl space-y-6 text-ink-soft">
        <h1 className="font-display text-5xl text-ink">Privacy</h1>
        <p className="text-sm italic text-muted">Last updated: 2026-05-18 · Year-1 testnet baseline</p>

        <section>
          <h2 className="font-display text-2xl text-ink">What we collect</h2>
          <p className="mt-2">
            Atrium runs on Arbitrum Sepolia testnet. Your wallet address is your identity.
            We do not collect names, emails, phone numbers, or other personally identifiable
            information for testnet usage. Codex API consumers may register a pseudonymous
            x402-payable key; that key is wallet-bound, not identity-bound.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">On-chain data</h2>
          <p className="mt-2">
            Every position, deposit, withdrawal, and mandate is on-chain on Arbitrum Sepolia.
            That data is public and permanent. We do not control it; we read it via The Graph
            (Scribe subgraph) and render it on this site.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">KYC / Edict</h2>
          <p className="mt-2">
            Tier-restricted venues (e.g. equity perps for US-restricted users) require
            jurisdiction verification via Sumsub. If you complete KYC, the result is bound
            to your wallet address as a tier flag on the Edict contract. We do not store
            the underlying KYC data — Sumsub does, per their privacy policy.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Analytics</h2>
          <p className="mt-2">
            We use Vercel Web Analytics with cookie-free measurement. No third-party tracking,
            no ad networks, no session replay.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Codex API logs</h2>
          <p className="mt-2">
            Codex retains the last 24 hours of API request logs (path, status, latency, wallet
            address, IP) for rate-limit enforcement and abuse detection. Logs older than 24
            hours are deleted automatically. See <code className="font-mono text-ink">services/codex/src/db/schema.sql</code>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Disclosure</h2>
          <p className="mt-2">
            Security disclosures: <code className="font-mono text-ink">security@atrium.fi</code> (PGP key in
            <Link href="/security" className="underline"> SECURITY.md</Link>). Privacy disclosures:
            <code className="font-mono text-ink"> privacy@atrium.fi</code>.
          </p>
        </section>

        <p className="text-sm italic text-muted">
          Mainnet privacy policy will land before any real funds are accepted. This page
          will be updated then; the testnet baseline is the published version until mainnet.
        </p>
      </article>
    </MarketingShell>
  );
}
