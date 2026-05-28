import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Atrium · Terms',
  description: 'Terms of use. Year-1 testnet, no real funds, MIT-licensed source.',
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl space-y-6 text-ink-soft">
        <h1 className="font-display text-5xl text-ink">Terms</h1>
        <p className="text-sm italic text-muted">Last updated: 2026-05-18 · Year-1 testnet baseline</p>

        <section>
          <h2 className="font-display text-2xl text-ink">Testnet only</h2>
          <p className="mt-2">
            Atrium is on Arbitrum Sepolia testnet through Year 1. No real funds are at risk.
            Tokens used in the app are testnet USDC; they have no monetary value.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">No warranty</h2>
          <p className="mt-2">
            The Atrium contracts and frontend are provided as-is. We aim for mainnet-grade
            quality on testnet for habit reasons, but the code has not yet been audited to
            mainnet standards. Year-2 mainnet launch is gated by a professional audit.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">License</h2>
          <p className="mt-2">
            Atrium source code is MIT-licensed source available now. The
            <code className="font-mono text-ink"> IPorticoAdapter v1.0</code> adapter standard
            is open from Day 1. Reference repos in <code className="font-mono text-ink">resources/</code>
            keep their own licenses (GPL-3.0 for ERC-4337 EntryPoint, BUSL for Aave V3) — integration only,
            no forking.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Use of the site</h2>
          <p className="mt-2">
            You may use Atrium for any lawful purpose. You may not use it to violate
            sanctions, attempt unauthorized access, or interfere with other users.
            Jurisdiction-restricted venues are tier-gated by Edict; bypassing the tier check
            is a misuse.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Modifications</h2>
          <p className="mt-2">
            We update the contracts behind a 3-of-5 Praetor multisig + 48-hour timelock.
            Community can object via Discord or Mirror during the 48h window. Frontend updates
            ship continuously.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Contact</h2>
          <p className="mt-2">
            Disputes or questions: <code className="font-mono text-ink">legal@atrium.fi</code>.
            Security disclosures: see <Link href="/security" className="underline">SECURITY.md</Link>.
          </p>
        </section>
      </article>
    </MarketingShell>
  );
}
