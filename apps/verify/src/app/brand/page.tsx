import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';

/**
 * /brand  the Atrium brand kit page.
 *
 * Source of truth: `design/Brand Kit.html`. Seven sections, roman numbered,
 * exactly as the canon file lays them out:
 *   I.   Logo  (wordmark sizes, app-icon gallery, construction spec)
 *   II.  Typography  (7 specimens)
 *   III. Colour  (8 swatches with OKLCH + HEX)
 *   IV.  Components  (buttons, status indicators, numerals, wordmark in product)
 *   V.   Voice  (Do / Don't)
 *   VI.  Trademark and usage  (You may / You may not)
 *   VII. Download  (SVG, PNG, ICO assets, typefaces)
 *
 * Per `docs/conventions/ui.md`: "Do not invent a parallel system." This page
 * surfaces the same 8 canonical tokens (paper, ink, accent oxblood, live
 * moss, testnet amber, neg clay, line, muted) that every component pulls
 * from `globals.css`.
 */
export const metadata = {
  title: 'Atrium . brand',
  description: 'Atrium brand kit. Tokens, typography, palette, logo. Source of truth.',
};

export default function BrandPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <Wordmark size="md" />
        <nav className="flex gap-6 text-sm text-ink-soft">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/verify/1" className="hover:text-ink">Verify</Link>
          <Link href="/security" className="hover:text-ink">Security</Link>
        </nav>
      </header>

      <section className="mt-16">
        <h1
          className="font-medium text-ink"
          style={{
            fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
            fontSize: 56,
            letterSpacing: '-0.03em',
          }}
        >
          Atrium brand.
        </h1>
        <p className="mt-4 max-w-prose text-ink-soft">
          The tokens, typography, palette, and components that ship in every Atrium surface.
          Source of truth: <code className="font-mono text-ink">design/Brand Kit.html</code>.
          Any disagreement between this page and the canon HTML is a bug. Open an issue or PR.
        </p>
      </section>

      {/* ============ I. LOGO ============ */}
      <Section roman="I" title="Logo">
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          Wordmark is Instrument Serif italic 400. Underline is 55 percent of the wordmark width.
          Display only; never set body text in Instrument Serif.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-4">
          {(['hero', 'lg', 'md', 'sm'] as const).map((size) => (
            <div key={size} className="rounded-md border border-line bg-paper p-6 text-center">
              <Wordmark size={size} />
              <p className="mt-3 text-xs text-muted">{size}</p>
            </div>
          ))}
        </div>

        {/* Wordmark on light + dark contexts */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-paper px-6 py-10 text-center">
            <Wordmark size="lg" />
            <p className="mt-3 text-xs uppercase tracking-widest text-muted">Light context</p>
          </div>
          <div className="rounded-md border border-ink bg-dark-bg px-6 py-10 text-center text-parchment">
            <span className="font-display text-4xl italic">Atrium</span>
            <p className="mt-3 text-xs uppercase tracking-widest text-dark-white-55">Inverse, same letterforms</p>
          </div>
        </div>

        {/* App icon gallery */}
        <h3 className="mt-12 font-display text-xl text-ink">App icon</h3>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          Ink tile, italic A, status bar at the base. The status bar tracks Plinth margin health
          and is the only animated element in the brand system.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-paper p-8">
            <div className="flex flex-wrap items-end gap-9 justify-center">
              {([160, 64, 32, 16] as const).map((size) => (
                <AppIcon key={size} size={size} status="testnet" />
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-widest text-muted">
              <span>App icon . 160 / 64 / 32 / 16</span>
              <span>Tile . italic A . status bar</span>
            </div>
          </div>

          <div className="rounded-md border border-line bg-paper p-8">
            <div className="flex flex-wrap items-end justify-center gap-7">
              <IconWithCaption status="testnet" caption="Testnet" />
              <IconWithCaption status="live" caption="Healthy" />
              <IconWithCaption status="neg" caption="Critical" />
            </div>
            <p className="mx-auto mt-6 max-w-xs text-center text-xs text-muted">
              Status bar breathes amber (testnet), green (healthy), red (paused or chaos trip).
            </p>
            <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-widest text-muted">
              <span>Live status . three states</span>
              <span>Amber . green . red</span>
            </div>
          </div>
        </div>

        {/* Construction spec */}
        <h3 className="mt-12 font-display text-xl text-ink">Construction</h3>
        <div className="mt-4 grid gap-6 rounded-md border border-line bg-paper p-6 sm:grid-cols-2">
          <Spec label="Wordmark typeface" value="Instrument Serif . italic 400" />
          <Spec label="App icon dimensions" value="64x64 grid . 14px corner radius" />
          <Spec label="Tracking" value="-0.014em" />
          <Spec label="A letterform" value="Instrument Serif italic 600 . 44px on grid" />
          <Spec label="Optical correction" value="translateX(-0.02em) at display sizes" />
          <Spec label="Optical centre" value="A baseline at y = 38 / 64 (offset -4 from centre)" />
          <Spec label="Minimum size" value="14px digital . 8pt print" />
          <Spec label="Status bar" value="44x6 . radius 2 . padding 10 . y = 48" />
          <Spec label="Clear space" value="1x cap-height on every side" />
          <Spec label="Animation" value="Status bar breathes . 0.45-1.0 alpha . 4s cycle" />
        </div>
      </Section>

      {/* ============ II. TYPOGRAPHY ============ */}
      <Section roman="II" title="Typography">
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          Geist for product UI and editorial copy. Geist Mono for figures, tickers, addresses, labels.
          Instrument Serif reserved for the wordmark only.
        </p>
        <div className="mt-6 space-y-4 rounded-md border border-line bg-paper p-6">
          <TypeRow specimen="One number across every venue."
            meta="Geist 500 . 64 / 67 . -0.025em . Display"
            className="text-[64px] font-medium leading-[1.04] tracking-[-0.025em]" />
          <TypeRow specimen="Section heading."
            meta="Geist 500 . 40 / 44 . -0.022em . Section"
            className="text-[40px] font-medium leading-[1.08] tracking-[-0.022em]" />
          <TypeRow specimen="Card title or callout  denser than display, still load-bearing."
            meta="Geist 500 . 22 / 29 . -0.012em . Title"
            className="text-[22px] font-medium leading-[1.32] tracking-[-0.012em]" />
          <TypeRow specimen="Body copy and lede paragraphs. Sets at 17 / 26 with a small negative tracking that gets the readability of a printed weekly without the weight of a book face."
            meta="Geist 400 . 17 / 26 . -0.005em . Body"
            className="text-[17px] leading-[1.55] max-w-[38em]" />
          <TypeRow specimen="$1,247,820.00 . 0x4f29...81e0 . arb-sepolia . 16:14 UTC"
            meta="Geist Mono 400 . 14 / 22 . Figures + addresses"
            className="font-mono text-[14px] leading-[1.55]" />
          <TypeRow specimen="ALL-CAPS MONO LABEL . POSITIONS . 8 VENUES"
            meta="Geist Mono 500 . 10.5 / 0.14em . Labels"
            className="font-mono text-[11.5px] uppercase tracking-[0.14em]" />
          <TypeRow specimen={<span className="font-display italic">Atrium</span>}
            meta="Instrument Serif italic . Wordmark only . Never body"
            className="text-[56px] leading-tight" />
        </div>
      </Section>

      {/* ============ III. COLOUR ============ */}
      <Section roman="III" title="Colour">
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          Warm paper, deep ink, and a restrained palette of state colours. Accent oxblood is used sparingly
          on hover states and emphasis only, never as decoration.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Swatch name="Paper"          role="Surface . background"          oklch="98.4% 0.004 85"  hex="#FBFAF7" tokenVar="--color-paper" />
          <Swatch name="Ink"            role="Foreground . text"             oklch="13% 0.008 60"    hex="#1A1714" tokenVar="--color-ink" />
          <Swatch name="Accent . oxblood" role="Emphasis . hover"            oklch="48% 0.13 28"     hex="#7E2A20" tokenVar="--color-accent" />
          <Swatch name="Live . moss"    role="Live status . positive P&L"    oklch="58% 0.13 145"    hex="#43864F" tokenVar="--color-live" />
          <Swatch name="Testnet . amber" role="Testnet pill . warning"       oklch="70% 0.13 70"     hex="#CC8E2D" tokenVar="--color-testnet" />
          <Swatch name="Negative . clay" role="Negative P&L . revoke . danger" oklch="56% 0.16 28"   hex="#A1352A" tokenVar="--color-neg" />
          <Swatch name="Line"           role="Borders . dividers"            oklch="88% 0.004 60"    hex="#DBD8D2" tokenVar="--color-line" />
          <Swatch name="Muted"          role="Secondary text . captions"     oklch="54% 0.005 60"    hex="#807872" tokenVar="--color-muted" />
        </div>
      </Section>

      {/* ============ IV. COMPONENTS ============ */}
      <Section roman="IV" title="Components">
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          A small set of primitives  buttons, pills, tags, numerals. Keep density high, edges
          sharp, and accent use exceptional.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* Buttons */}
          <ComponentCard title="Buttons" cap="Pill . 38px">
            {/* Brand-kit samples, not real CTAs. type="button" prevents accidental
                form submission; aria-label names them as examples. */}
            <div className="flex flex-wrap gap-2.5">
              <button type="button" aria-label="Primary button sample"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 h-[38px] text-sm font-medium text-paper hover:bg-ink/90">
                Open testnet
              </button>
              <button type="button" aria-label="Ghost button sample"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-5 h-[38px] text-sm font-medium text-ink hover:border-ink/30">
                Read documentation
              </button>
              <button type="button" aria-label="Live action sample"
                className="inline-flex items-center gap-2 rounded-full bg-live px-5 h-[38px] text-sm font-medium text-paper hover:bg-live/90">
                Open long
              </button>
              <button type="button" aria-label="Negative action sample"
                className="inline-flex items-center gap-2 rounded-full bg-neg px-5 h-[38px] text-sm font-medium text-paper hover:bg-neg/90">
                Revoke
              </button>
            </div>
          </ComponentCard>

          {/* Status indicators */}
          <ComponentCard title="Status indicators" cap="Pills . tags . dots">
            <div className="flex flex-wrap gap-2.5">
              <Pill color="live" label="live . arb-sepolia" />
              <Pill color="testnet" label="testnet" />
              <Tag tone="live" label="healthy" />
              <Tag tone="testnet" label="warning" />
              <Tag tone="neg" label="critical" />
            </div>
          </ComponentCard>

          {/* Numerals */}
          <ComponentCard title="Numerals" cap="Geist Mono . tabular">
            <div className="flex flex-col gap-2 font-mono">
              <div className="text-[28px] tracking-[-0.022em] text-ink">$12,378,422</div>
              <div className="text-[18px] text-ink">+ 14.82% . 7d P&amp;L</div>
              <div className="text-[13px] text-muted">0x4f29...81e0 . block #8,142,317</div>
            </div>
          </ComponentCard>

          {/* Wordmark in product */}
          <ComponentCard title="Wordmark . in product" cap="Brand voice">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-md bg-parchment-soft px-3.5 py-3">
                <span className="font-display text-[22px] italic text-ink">Atrium</span>
                <Pill color="testnet" label="testnet" />
              </div>
              <div className="flex items-center gap-3 rounded-md bg-dark-bg px-3.5 py-3">
                <span className="font-display text-[22px] italic text-parchment">Atrium</span>
                <Pill color="testnet" label="testnet" dark />
              </div>
            </div>
          </ComponentCard>
        </div>
      </Section>

      {/* ============ V. VOICE ============ */}
      <Section roman="V" title="Voice">
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          Atrium speaks like a financial-grade product, not a crypto-native one. Specific over poetic,
          declarative over aspirational, plain over branded.
        </p>

        <div className="mt-6 rounded-md border border-line bg-paper p-6">
          <div className="grid grid-cols-[200px_1fr] gap-6 py-1.5">
            <div className="text-xs uppercase tracking-widest text-muted">We are</div>
            <div className="text-[17px] leading-[1.55] text-ink">
              Precise. Restrained. Architectural. Quietly confident.
            </div>
          </div>
          <div className="my-3.5 border-t border-line" />
          <div className="grid grid-cols-[200px_1fr] gap-6 py-1.5">
            <div className="text-xs uppercase tracking-widest text-muted">We are not</div>
            <div className="text-[17px] leading-[1.55] text-ink">
              Hyped. Memed. Decorative. Approximate. &ldquo;Revolutionary.&rdquo;
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-line bg-paper p-6">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-live-soft px-2.5 py-1 text-xs font-medium text-live">
              <span aria-hidden>✓</span> Do
            </div>
            <p className="mt-3 font-display text-[22px] italic leading-[1.35] tracking-[-0.012em] text-ink">
              &ldquo;Atrium computes a SPAN-style cross-product margin number across eight onchain venues.&rdquo;
            </p>
            <p className="mt-3 text-[13px] leading-[1.5] text-muted">
              Specific. Names the mechanism. Counts the venues. Tells you what it is.
            </p>
          </div>
          <div className="rounded-md border border-line bg-paper p-6">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-neg-soft px-2.5 py-1 text-xs font-medium text-neg">
              <span aria-hidden>✗</span> Don&rsquo;t
            </div>
            <p className="mt-3 font-display text-[22px] italic leading-[1.35] tracking-[-0.012em] text-ink/70">
              &ldquo;Atrium revolutionises onchain capital efficiency with next-generation prime brokerage infra.&rdquo;
            </p>
            <p className="mt-3 text-[13px] leading-[1.5] text-muted">
              Marketing slop. Vague. Borrowed from every other DeFi pitch deck.
            </p>
          </div>
        </div>
      </Section>

      {/* ============ VI. TRADEMARK ============ */}
      <Section roman="VI" title="Trademark and usage">
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          What you can and cannot do with the Atrium name and assets.
        </p>
        <div className="mt-6 rounded-md border border-line bg-paper p-6">
          <div className="grid grid-cols-[180px_1fr] items-start gap-6 py-2.5">
            <div className="text-xs uppercase tracking-widest text-muted">You may</div>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-[1.8] text-ink-soft">
              <li>Refer to Atrium by name in editorial, journalistic, or research contexts</li>
              <li>Embed the wordmark in articles or research notes that reference Atrium</li>
              <li>Build venue adapters and reference the Atrium name in your project</li>
              <li>Use the colour palette and typography for derivative open-source work</li>
            </ul>
          </div>
          <div className="my-3.5 border-t border-line" />
          <div className="grid grid-cols-[180px_1fr] items-start gap-6 py-2.5">
            <div className="text-xs uppercase tracking-widest text-muted">You may not</div>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-[1.8] text-ink-soft">
              <li>Use the Atrium name or wordmark to imply endorsement of a product</li>
              <li>Distribute a competing product under the Atrium name</li>
              <li>Alter the wordmark&rsquo;s letterforms, italic angle, or tracking</li>
              <li>Use the wordmark on collateral that misrepresents Atrium&rsquo;s offering</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* ============ VII. DOWNLOAD ============ */}
      <Section roman="VII" title="Download">
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          All brand assets in vector and raster formats. Brand kit licensed CC-BY-4.0; wordmark trademark
          reserved by Atrium Labs Ltd.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ComponentCard title="Wordmark" cap="SVG . PNG">
            <div className="flex flex-wrap gap-2">
              {/* Phase eta.10 (2026-05-25): rasters generated via
                  scripts/generate-brand-rasters.mjs using sharp. Run on
                  any SVG change; CI regenerates on PR. */}
              <DownloadLink href="/brand/assets/atrium-wordmark.svg">atrium-wordmark.svg</DownloadLink>
              <DownloadLink href="/brand/assets/atrium-wordmark-dark.svg">atrium-wordmark-dark.svg</DownloadLink>
              <DownloadLink href="/brand/assets/atrium-wordmark-2x.png">PNG 2x</DownloadLink>
              <DownloadLink href="/brand/assets/atrium-wordmark-4x.png">PNG 4x</DownloadLink>
            </div>
          </ComponentCard>
          <ComponentCard title="App icon" cap="SVG . PNG . ICO">
            <div className="flex flex-wrap gap-2">
              <DownloadLink href="/brand/assets/atrium-icon.svg">atrium-icon.svg</DownloadLink>
              <DownloadLink href="/favicon.ico">favicon.ico</DownloadLink>
              <DownloadLink href="/brand/assets/apple-touch-icon.png">apple-touch-icon 180</DownloadLink>
              <DownloadLink href="/brand/assets/android-icon-192.png">android 192</DownloadLink>
              <DownloadLink href="/brand/assets/android-icon-512.png">android 512</DownloadLink>
            </div>
          </ComponentCard>
          <div className="md:col-span-2">
            <ComponentCard title="Typeface" cap="OFL . Google Fonts">
              <div className="flex flex-wrap gap-2">
                <DownloadLink href="https://fonts.google.com/specimen/Geist" external>Geist . Sans</DownloadLink>
                <DownloadLink href="https://fonts.google.com/specimen/Geist+Mono" external>Geist Mono</DownloadLink>
                <DownloadLink href="https://fonts.google.com/specimen/Instrument+Serif" external>Instrument Serif</DownloadLink>
              </div>
            </ComponentCard>
          </div>
        </div>
      </Section>

      <footer className="mt-24 flex items-center justify-between border-t border-line pt-6 text-xs text-muted">
        <span>(c) 2026 Atrium Labs Ltd.</span>
        <span>Brand kit v1.0 . 2026.05</span>
        <Pill color="testnet" label="testnet" />
      </footer>
    </main>
  );
}

/* ============ helpers ============ */

function Section({ roman, title, children }: { roman: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-16">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-xl italic text-muted">{roman}</span>
        <h2 className="font-display text-3xl text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Swatch({
  name,
  role,
  oklch,
  hex,
  tokenVar,
}: {
  name: string;
  role: string;
  oklch: string;
  hex: string;
  tokenVar: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div
        className="h-20 w-full"
        style={{ background: `var(${tokenVar})` }}
        aria-label={`${name} swatch`}
      />
      <div className="bg-paper p-3.5">
        <p className="text-[13px] font-medium text-ink">{name}</p>
        <p className="mt-0.5 text-xs text-muted">{role}</p>
        <div className="mt-2 grid grid-cols-[40px_1fr] gap-x-2 text-xs">
          <span className="uppercase tracking-widest text-muted">OKLCH</span>
          <span className="font-mono text-ink">{oklch}</span>
          <span className="uppercase tracking-widest text-muted">HEX</span>
          <span className="font-mono text-ink">{hex}</span>
        </div>
      </div>
    </div>
  );
}

function TypeRow({
  specimen,
  meta,
  className,
}: {
  specimen: React.ReactNode;
  meta: string;
  className?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_220px] items-baseline gap-6 border-b border-line pb-4 last:border-b-0 last:pb-0">
      <div className={`text-ink ${className ?? ''}`}>{specimen}</div>
      <div className="whitespace-pre-line font-mono text-[11.5px] leading-[1.45] text-muted">
        {meta.split(' . ').join('\n')}
      </div>
    </div>
  );
}

function ComponentCard({
  title,
  cap,
  children,
}: {
  title: string;
  cap: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-line bg-paper p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className="text-xs uppercase tracking-widest text-muted">{cap}</span>
      </div>
      {children}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-1.5 font-mono text-[13px] text-ink">{value}</div>
    </div>
  );
}

function Pill({
  color,
  label,
  dark = false,
}: {
  color: 'live' | 'testnet' | 'neg';
  label: string;
  dark?: boolean;
}) {
  const ring =
    color === 'live'
      ? 'border-live/30 bg-live-soft text-live'
      : color === 'testnet'
      ? 'border-testnet/30 bg-testnet-soft text-testnet'
      : 'border-neg/30 bg-neg-soft text-neg';
  const dot =
    color === 'live' ? 'bg-live' : color === 'testnet' ? 'bg-testnet' : 'bg-neg';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${ring} ${
        dark ? 'bg-white/10 text-white border-white/20' : ''
      }`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  );
}

function Tag({ tone, label }: { tone: 'live' | 'testnet' | 'neg'; label: string }) {
  const cls =
    tone === 'live'
      ? 'border-live/30 bg-live-soft text-live'
      : tone === 'testnet'
      ? 'border-testnet/30 bg-testnet-soft text-testnet'
      : 'border-neg/30 bg-neg-soft text-neg';
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function AppIcon({
  size,
  status,
}: {
  size: 160 | 64 | 32 | 16;
  status: 'testnet' | 'live' | 'neg';
}) {
  const fill = status === 'testnet' ? '#CC8E2D' : status === 'live' ? '#43864F' : '#A1352A';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label={`App icon ${size}px`}>
      <rect width="64" height="64" rx="14" fill="#1A1714" />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="'Instrument Serif', Georgia, serif"
        fontStyle="italic"
        fontWeight="600"
        fontSize="44"
        fill="#FBFAF7"
      >
        A
      </text>
      <rect x="10" y="48" width="44" height="6" rx="2" fill={fill} opacity={status === 'testnet' ? 0.85 : 1} />
    </svg>
  );
}

function IconWithCaption({ status, caption }: { status: 'testnet' | 'live' | 'neg'; caption: string }) {
  return (
    <div className="text-center">
      <AppIcon size={64} status={status} />
      <div className="mt-2.5 text-xs uppercase tracking-widest text-muted">{caption}</div>
    </div>
  );
}

function DownloadLink({
  href,
  external = false,
  pending = false,
  children,
}: {
  href?: string;
  external?: boolean;
  pending?: boolean;
  children: React.ReactNode;
}) {
  // Pending variant renders as a non-interactive label so the asset surface
  // stays visually present without serving a 404. Matches the "honest
  // pending" pattern from docs/conventions/ui.md.
  if (pending || !href) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/60 px-4 h-[34px] text-xs font-medium text-muted cursor-not-allowed"
        aria-disabled="true"
        title="Asset not yet generated"
      >
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 h-[34px] text-xs font-medium text-ink hover:border-ink/30"
    >
      {children}
    </a>
  );
}
