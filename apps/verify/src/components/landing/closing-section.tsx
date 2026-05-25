import Link from 'next/link';

/**
 * Closing CTA. Canon `.closing` in desing/extracted/Atriumnew/index.html:1396-1424
 * sets `background: var(--dark-bg)` (oklch(11% 0.008 60), near-black). Previous
 * implementation rendered on bg-parchment-light which inverted the landing's
 * intended chrome  the closing slab is supposed to be the dark anchor that
 * mirrors the Sigil dark section above it. Fixed to dark variant 2026-05-25.
 */
export function ClosingSection() {
  return (
    <section className="closing section-dark border-t border-dark-white-24">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center md:py-32">
        <p className="eyebrow text-dark-white-55">Testnet . now open</p>
        <h2 className="font-display-hero mt-4 text-4xl italic text-dark-fg md:text-[64px]">
          Step inside.
          <br />
          The testnet is open.
        </h2>
        <p className="mx-auto mt-6 max-w-prose text-lg text-dark-white-55">
          The testnet faucet hands new wallets onboarding USDC and rAAPL once the contracts deploy
          to Sepolia. Onboard with a passkey — no seed phrase.
        </p>
        <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-testnet/40 bg-testnet/10 px-3 py-1 text-[10px] uppercase tracking-wider text-testnet">
          {/* Audit P-12 fix: the specific drop amounts (10K USDC, 5K rAAPL)
              were presented as fact even though the faucet isn't live yet.
              Numbers are now in the "Build state" panel below, gated. */}
          <span className="size-1.5 rounded-full bg-testnet" /> faucet pending . deploys Month 1 W2
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app/onboarding"
            className="inline-flex items-center gap-1.5 rounded-full bg-parchment px-5 h-[44px] text-sm font-medium text-ink hover:bg-parchment-light"
          >
            Open testnet <span aria-hidden>↗</span>
          </Link>
          <Link
            href="/brand"
            className="inline-flex items-center gap-1.5 rounded-full border border-dark-white-24 bg-transparent px-5 h-[44px] text-sm text-dark-fg hover:border-dark-white-55"
          >
            Brand kit
          </Link>
        </div>
      </div>
    </section>
  );
}
