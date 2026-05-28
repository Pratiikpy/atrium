import Link from 'next/link';

/**
 * Hero — "One wallet. Every venue. One buying-power number."
 *
 * Port of design/Atriumnew.html section#hero.hero-monument. Dark
 * "monument" hero with centered eyebrow + headline + engineering chrome
 * + venue cards row + unified-margin pool card + leverage ladder.
 *
 * Design tokens (from design/Atriumnew.html computed styles):
 *   bg     oklch(0.11 0.008 60)   — near-black warm
 *   ink    oklch(0.96 0.003 60)   — near-white warm
 *   accent #C46A5E                — terracotta italic emphasis (lifted for dark bg)
 *   font   Geist 500 (display)    — clamp(36px,7vw,77px) / lh 1.04 / tracking -0.03em
 *
 * Numbers on the venue cards + pool card are the design's reference
 * layout values. Live deployment fills these from Scribe + RPC reads via
 * the same data-shape; until then they render as the design's static
 * preview, matching the visual contract per design/Atriumnew.html.
 */
export function HeroSection() {
  return (
    <section
      id="hero"
      className="hero-monument relative isolate overflow-hidden bg-[oklch(0.11_0.008_60)] text-[oklch(0.96_0.003_60)]"
    >
      {/* soft vignette so the cards have a focal pool */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 30%, oklch(0.16 0.014 30 / 0.55) 0%, transparent 70%)',
        }}
      />

      <div className="mx-auto max-w-[1240px] px-6 pb-32 pt-28 md:px-14 md:pb-40 md:pt-32">
        {/* Eyebrow */}
        <p className="mx-auto flex max-w-md items-center justify-center gap-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[oklch(0.72_0.004_60)]">
          <span aria-hidden className="h-px w-6 bg-[oklch(0.72_0.004_60_/_0.4)]" />
          <span>Prime brokerage</span>
          <span aria-hidden className="text-[oklch(0.72_0.004_60_/_0.5)]">·</span>
          <span>Unified margin</span>
          <span aria-hidden className="text-[oklch(0.72_0.004_60_/_0.5)]">·</span>
          <span>Testnet</span>
          <span aria-hidden className="h-px w-6 bg-[oklch(0.72_0.004_60_/_0.4)]" />
        </p>

        {/* Headline */}
        <h1
          className="mx-auto mt-6 max-w-5xl text-center font-medium leading-[1.04] tracking-[-0.03em]"
          style={{
            fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
            color: 'oklch(0.96 0.003 60)',
            fontSize: 'clamp(36px, 7vw, 77px)',
          }}
        >
          One wallet. Every venue.
          <br />
          One{' '}
          <span
            className="italic"
            style={{
              fontFamily: '"Instrument Serif", "Times New Roman", serif',
              color: 'oklch(0.96 0.003 60)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            buying-power
          </span>{' '}
          number.
        </h1>

        {/* Engineering-document chrome */}
        <div className="mx-auto mt-12 max-w-[1100px] border-t border-[oklch(0.22_0.006_60)] pt-3">
          <div className="grid grid-cols-2 gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[oklch(0.72_0.004_60)]">
            <div>
              <p>Fig. 01 · Capital convergence</p>
              <p className="mt-1.5">Plan view · live testnet feed</p>
            </div>
            <div className="text-right">
              <p>Sheet 02 / 08</p>
              <p className="mt-1.5">Atrium Labs · May 2026</p>
            </div>
          </div>
        </div>

        {/* Venue cards — row 1 */}
        <div className="mx-auto mt-10 grid max-w-[1100px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <VenueCard name="Hyperliquid HIP-3" tag="HL-HIP3" kind="Tokenized-stock perps" tvl="$1,252,181" assets="USDC · WETH" share="34.8%" />
          <VenueCard name="Hyperliquid HIP-4" tag="HL-HIP4" kind="Permissioned perps" tvl="$484,434" assets="USDC" share="13.5%" />
          <VenueCard name="Aave Horizon" tag="AAVE-V3" kind="RWA collateral" tvl="$891,827" assets="aUSDC · USTB" share="24.9%" />
          <VenueCard name="Pendle V2" tag="PENDLE" kind="Fixed-yield · PT" tvl="$319,446" assets="PT-stETH" share="8.9%" />
        </div>

        {/* Pool card — unified margin pool */}
        <div className="mx-auto mt-3 max-w-[1100px]">
          <div className="rounded-md border border-[oklch(0.22_0.006_60)] bg-[oklch(0.13_0.008_60)] p-7 md:p-9">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[oklch(0.72_0.004_60)]">
                Pool · Unified margin
              </p>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[oklch(0.72_0.13_145)]">
                <span aria-hidden className="size-1.5 rounded-full bg-[oklch(0.72_0.13_145)]" />
                Live
              </span>
            </div>
            <p
              className="mt-4 font-mono leading-none tracking-[-0.02em] text-[oklch(0.96_0.003_60)]"
              style={{ fontVariantNumeric: 'tabular-nums lining-nums', fontSize: 'clamp(44px, 6vw, 64px)' }}
            >
              $10,783,563
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[oklch(0.72_0.004_60)] md:grid-cols-3">
              <div>Buying power · 3.0× portfolio margin</div>
              <div className="md:text-center">Collateral $3.59M</div>
              <div className="md:text-right">
                <span className="inline-flex items-center gap-1.5 text-[oklch(0.72_0.13_145)]">
                  <span aria-hidden className="size-1.5 rounded-full bg-[oklch(0.72_0.13_145)]" />
                  Plinth · margin ok
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Venue cards — row 2 */}
        <div className="mx-auto mt-3 grid max-w-[1100px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <VenueCard name="Curve" tag="CURVE" kind="Stableswap LP" tvl="$186,210" assets="3pool LP" share="5.2%" />
          <VenueCard name="Trade.xyz" tag="TRADE" kind="RFQ · dark pool" tvl="$402,045" assets="WETH · WBTC" share="11.2%" />
          <VenueCard name="Polymarket" tag="PMK" kind="Prediction · CTF" tvl="$58,379" assets="USDC" share="1.6%" />
          <VenueCard name="RH-Chain" tag="RH-NTV" kind="Native spot · pending" tvl="$0" assets="—" share="0.0%" muted />
        </div>

        {/* Leverage ladder + portfolio-margin indicator (design parity #4) */}
        <div className="mx-auto mt-10 max-w-[1100px]">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[oklch(0.5_0.005_60)]">
            {['0×', '2×', '4×', '6×', '8×', '10×'].map((stop, i) => (
              <span key={stop} className={i === 3 ? 'text-[oklch(0.72_0.004_60)]' : ''}>
                {stop}
              </span>
            ))}
          </div>
          <div className="mt-2 h-px bg-[oklch(0.22_0.006_60)]" />
          <div className="mt-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[oklch(0.5_0.005_60)]">
            <span>Portfolio margin</span>
            <span className="inline-flex items-center gap-1.5 text-[oklch(0.96_0.003_60)]">
              <span aria-hidden className="size-1.5 rounded-full bg-[oklch(0.72_0.13_145)]" />
              3.0×
            </span>
          </div>
        </div>

        {/* CTAs — design parity #2: dual CTA (Open testnet white pill + See the product dark pill) */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-full bg-[oklch(0.96_0.003_60)] px-6 py-3 text-sm font-medium text-[oklch(0.13_0.008_60)] transition hover:bg-white"
          >
            Open testnet
            <span aria-hidden>↗</span>
          </Link>
          <a
            href="#portfolio"
            className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm transition"
            style={{ borderColor: 'oklch(0.32 0.006 60)', color: 'oklch(0.96 0.003 60)' }}
          >
            See the product
            <span aria-hidden>→</span>
          </a>
        </div>

        {/* Trust strip — design parity #3: green-dot stack of integrations */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[oklch(0.72_0.004_60)]">
          {[
            'Arbitrum Sepolia',
            'Chainlink CCIP',
            'ERC-8004',
            'ERC-4337 · 7702',
          ].map((label) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: 'oklch(0.58 0.13 145)' }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function VenueCard({
  name,
  tag,
  kind,
  tvl,
  assets,
  share,
  muted = false,
}: {
  name: string;
  tag: string;
  kind: string;
  tvl: string;
  assets: string;
  share: string;
  muted?: boolean;
}) {
  return (
    <div
      className={
        'rounded-md border border-[oklch(0.22_0.006_60)] bg-[oklch(0.13_0.008_60)] p-5 ' +
        (muted ? 'opacity-60' : '')
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-[oklch(0.96_0.003_60)]">{name}</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[oklch(0.5_0.005_60)]">
          {tag}
        </p>
      </div>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[oklch(0.5_0.005_60)]">
        {kind}
      </p>
      <p
        className="mt-5 font-mono text-2xl text-[oklch(0.96_0.003_60)]"
        style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
      >
        {tvl}
      </p>
      <div className="mt-1 h-px bg-[oklch(0.22_0.006_60)]" />
      <div className="mt-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[oklch(0.72_0.004_60)]">
        <span>{assets}</span>
        <span className="text-[oklch(0.96_0.003_60)]">{share}</span>
      </div>
    </div>
  );
}
