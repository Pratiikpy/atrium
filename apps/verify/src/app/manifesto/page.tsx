import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';

export const metadata = {
  title: 'Atrium · Manifesto',
  description: 'Why Atrium exists. What we will not do. What we will.',
};

export default function ManifestoPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="flex items-center justify-between">
        <Wordmark size="md" />
        <nav className="flex gap-6 text-sm text-ink-soft">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/team" className="hover:text-ink">Team</Link>
          <Link href="/app" className="hover:text-ink">App</Link>
        </nav>
      </header>

      <article className="mt-16 space-y-8 text-ink-soft">
        <h1 className="font-display text-5xl text-ink">Manifesto</h1>

        <p className="text-lg">
          A trader who is long $3M of perp and long $500K of T-bills is hedged.
          The risk has been reduced. Most of the collateral they posted to do this
          is just sitting there, locked, doing nothing for them. That is broken.
        </p>

        <p>
          Every venue today does its own isolated margin. Hyperliquid does perp
          margin. Aave does borrow margin. Pendle does its own. Each computes
          risk in a silo. Each demands collateral as if your account was a single
          one-sided position. Hedged risk is not priced into the math.
        </p>

        <p>
          Atrium does the math. One vault. One margin number. The hedge is
          recognized. The capital that should not be locked, is not.
        </p>

        <h2 className="font-display text-3xl text-ink">What we will not do</h2>
        <ul className="space-y-3">
          <li>· Invent a number to look impressive in a deck.</li>
          <li>· Claim a partner who has not signed.</li>
          <li>· Ship a green CI badge that lies about its source.</li>
          <li>· Treat formal verification as a sticker. We Kani-verify what the contract actually does.</li>
          <li>· Hide failure modes. The audit register is in the repo and updates same-day.</li>
        </ul>

        <h2 className="font-display text-3xl text-ink">What we will</h2>
        <ul className="space-y-3">
          <li>· Stay testnet for Year 1. No real money at risk until the audit closes mainnet-grade.</li>
          <li>· Keep the contracts upgradeable behind a 48-hour timelock and a 3-of-5 multisig. Year-1 needs to fix bugs fast.</li>
          <li>· Publish proofs of reserves hourly. Anyone can verify their own balance in 10 seconds.</li>
          <li>· Open-source the adapter standard. Curator grant for every accepted adapter and reference agent.</li>
          <li>· Let agents trade for you under bounded mandates. One-tap revocation of every delegation in a single tx.</li>
        </ul>

        <h2 className="font-display text-3xl text-ink">What we are building toward</h2>
        <p>
          A prime-brokerage layer that the EVM has not had: collateral
          posted once, priced as a portfolio, accessible to every venue
          that meets the Portico adapter standard. Open-sourced. Formally
          verified where the math matters most. Honest about every
          remaining mock, relay, and stub until the production paths land.
        </p>
      </article>
    </main>
  );
}
