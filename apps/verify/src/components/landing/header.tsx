import Link from 'next/link';

/**
 * Marketing header. Canon `.nav` in desing/extracted/Atriumnew/index.html:544-572
 * is a 3-col grid (brand, centered nav, right CTA) with sticky 68px height and
 * blurred parchment background. Previously rendered as a 2-col flex
 * (justify-between) which left the nav links flush-left next to the brand
 * instead of centered. Fixed to 3-col grid 2026-05-25.
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-divider bg-parchment/85 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-6 px-6 py-4">
        <Link href="/" className="font-display text-2xl italic text-ink">
          Atrium
        </Link>
        <nav className="hidden justify-center gap-6 text-sm md:flex">
          <a href="#product" className="text-ink-soft hover:text-ink">Product</a>
          <a href="#agents" className="text-ink-soft hover:text-ink">Agents</a>
          <a href="#network" className="text-ink-soft hover:text-ink">Network</a>
          <a href="#system" className="text-ink-soft hover:text-ink">Subsystems</a>
          <Link href="/docs" className="text-ink-soft hover:text-ink">Docs</Link>
        </nav>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-parchment-light px-4 h-[34px] text-sm text-ink hover:border-ink/30"
        >
          Open testnet <span aria-hidden>↗</span>
        </Link>
      </div>
    </header>
  );
}
