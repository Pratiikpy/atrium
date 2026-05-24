import Link from 'next/link';

/**
 * Marketing header — sticky top nav matching desing/Atrium.html.
 * Anchors: Product · Agents · Network · Subsystems · Docs · Open testnet ↗
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-divider bg-parchment/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-2xl italic text-ink">
          Atrium
        </Link>
        <nav className="hidden gap-6 text-sm md:flex">
          <a href="#product" className="text-ink-soft hover:text-ink">Product</a>
          <a href="#agents" className="text-ink-soft hover:text-ink">Agents</a>
          <a href="#network" className="text-ink-soft hover:text-ink">Network</a>
          <a href="#system" className="text-ink-soft hover:text-ink">Subsystems</a>
          <Link href="/docs" className="text-ink-soft hover:text-ink">Docs</Link>
        </nav>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 rounded-md border border-divider bg-parchment-light px-4 py-2 text-sm text-ink hover:border-ink/30"
        >
          Open testnet <span aria-hidden>↗</span>
        </Link>
      </div>
    </header>
  );
}
