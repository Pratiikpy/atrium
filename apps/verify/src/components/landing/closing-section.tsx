import Link from 'next/link';

/**
 * Closing, port of design/Atriumnew.html section#open.closing.
 * Dark slab anchoring the bottom of the landing. Matches the hero's
 * dark monument so the page bookends.
 *
 * Typography: Geist 500 (NOT Instrument Serif italic, design uses
 * bold sans for the closing headline to mirror the hero, with the
 * italic-serif accent reserved for the hero's 'buying-power' emphasis).
 */
export function ClosingSection() {
  return (
    <section
      id="open"
      className="closing border-t"
      style={{
        backgroundColor: 'oklch(0.11 0.008 60)',
        color: 'oklch(0.96 0.003 60)',
        borderColor: 'oklch(0.22 0.006 60)',
      }}
    >
      <div className="mx-auto max-w-3xl px-6 py-28 text-center md:py-40">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[oklch(0.72_0.004_60)]">
          Testnet · now open
        </p>
        <h2
          className="mx-auto mt-5 max-w-3xl font-sans font-medium leading-[1.04] tracking-[-0.03em]"
          style={{
            color: 'oklch(0.96 0.003 60)',
            fontSize: 'clamp(36px, 6vw, 64px)',
          }}
        >
          Step inside.
          <br />
          The testnet is open.
        </h2>
        <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[oklch(0.72_0.004_60)]">
          Faucet drops 5 test USDC + 0.0005 ETH per claim (24h cooldown). Three minutes from passkey login to first cross-margin trade.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app/onboarding"
            className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.96_0.003_60)] px-6 py-3 text-sm font-medium text-[oklch(0.13_0.008_60)] transition hover:bg-white"
          >
            Open testnet <span aria-hidden>↗</span>
          </Link>
          <Link
            href="/brand"
            className="inline-flex items-center gap-1.5 rounded-full border px-6 py-3 text-sm transition"
            style={{
              borderColor: 'oklch(0.32 0.006 60)',
              color: 'oklch(0.96 0.003 60)',
            }}
          >
            Brand kit
          </Link>
        </div>
      </div>
    </section>
  );
}
