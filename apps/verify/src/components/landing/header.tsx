import Link from 'next/link';

/**
 * Marketing header — over-dark variant matching design/Atriumnew.html
 * `header.nav.over-dark`. Sticky, semi-transparent dark backdrop with
 * blurred backdrop so the hero monument shows through.
 *
 * Layout: brand (left), 5 nav links (centered), TESTNET pill + Open
 * testnet CTA (right). The pill is the design's amber `--testnet`
 * accent and signals the deployment mode at all times.
 */
export function LandingHeader() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-[oklch(0.22_0.006_60)] backdrop-blur"
      style={{ backgroundColor: 'oklch(0.11 0.008 60 / 0.85)' }}
    >
      <div className="mx-auto grid max-w-[1240px] grid-cols-[auto_1fr_auto] items-center gap-6 px-6 py-4 md:px-14">
        <Link
          href="/"
          className="text-2xl italic"
          style={{
            fontFamily: '"Instrument Serif", "Times New Roman", serif',
            color: 'oklch(0.96 0.003 60)',
          }}
        >
          Atrium
        </Link>

        <nav className="hidden justify-center gap-7 text-sm md:flex">
          <a href="#portfolio" className="text-[oklch(0.72_0.004_60)] transition hover:text-[oklch(0.96_0.003_60)]">Product</a>
          <a href="#agents" className="text-[oklch(0.72_0.004_60)] transition hover:text-[oklch(0.96_0.003_60)]">Agents</a>
          <a href="#reserves" className="text-[oklch(0.72_0.004_60)] transition hover:text-[oklch(0.96_0.003_60)]">Reserves</a>
          <a href="#system" className="text-[oklch(0.72_0.004_60)] transition hover:text-[oklch(0.96_0.003_60)]">Subsystems</a>
          <Link href="/docs" className="text-[oklch(0.72_0.004_60)] transition hover:text-[oklch(0.96_0.003_60)]">Docs</Link>
        </nav>

        <div className="flex items-center gap-3">
          <span
            className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] sm:inline-flex"
            style={{
              borderColor: 'oklch(0.7 0.13 70 / 0.45)',
              color: 'oklch(0.85 0.13 70)',
            }}
          >
            <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: 'oklch(0.7 0.13 70)' }} />
            Testnet
          </span>
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.96_0.003_60)] px-4 py-1.5 text-sm font-medium text-[oklch(0.13_0.008_60)] transition hover:bg-white"
          >
            Open testnet <span aria-hidden>↗</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
