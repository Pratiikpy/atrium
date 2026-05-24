import Link from 'next/link';

export function ClosingSection() {
  return (
    <section className="closing border-t border-divider bg-parchment-light">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center md:py-32">
        <p className="eyebrow">Testnet · now open</p>
        <h2 className="font-display-hero mt-4 text-4xl italic text-ink md:text-[64px]">
          Step inside.
          <br />
          The testnet is open.
        </h2>
        <p className="mx-auto mt-6 max-w-prose text-lg text-ink-soft">
          The testnet faucet hands new wallets onboarding USDC and rAAPL once the contracts deploy
          to Sepolia. Three minutes from passkey login to first cross-margin trade.
        </p>
        <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/5 px-3 py-1 text-[10px] uppercase tracking-wider text-warning">
          {/* Audit P-12 fix: the specific drop amounts (10K USDC, 5K rAAPL)
              were presented as fact even though the faucet isn't live yet.
              Numbers are now in the "Build state" panel below, gated. */}
          <span className="size-1.5 rounded-full bg-warning" /> faucet pending · deploys Month 1 W2
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app/onboarding"
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-5 py-3 text-sm font-medium text-parchment hover:bg-ink-dark"
          >
            Open testnet <span aria-hidden>↗</span>
          </Link>
          <Link
            href="/brand"
            className="inline-flex items-center gap-1.5 rounded-md border border-divider bg-parchment px-5 py-3 text-sm text-ink hover:border-ink/30"
          >
            Brand kit
          </Link>
        </div>
      </div>
    </section>
  );
}
