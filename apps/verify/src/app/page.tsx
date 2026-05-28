import Link from 'next/link';
import { PublicNav } from '@/components/atrium/PublicNav';
import { Footer } from '@/components/atrium/Footer';
import { BlueprintGrid, Vignette } from '@/components/atrium/HeroChrome';
import { Impluvium } from '@/components/atrium/Impluvium';
import { Card, SectionHead, Tag } from '@/components/atrium/primitives';
import { MobileLanding } from '@/components/atrium/mobile/MobileLanding';
import {
  Feature,
  PortfolioMock,
  AqueductMock,
  SigilMock,
  LanternMock,
} from '@/components/atrium/landing/Features';
import { Numbers } from '@/components/atrium/landing/Numbers';
import { FloorPlanSection } from '@/components/atrium/landing/FloorPlan';
import { VENUES, SUBSYSTEMS, PARTNERS, fmtUSD } from '@/lib/atrium/mock';

export const metadata = {
  title: 'Atrium — one wallet, every venue, one buying-power number',
  description:
    'Unified margin prime brokerage for the EVM. Deposit USDC once. Trade across perps, lending, yield, and prediction markets with one buying-power number. Testnet-first.',
  openGraph: {
    title: 'Atrium — unified margin prime brokerage',
    description:
      'Deposit once. Net cross-venue hedges. One buying-power number across every venue. Built testnet-first on Arbitrum Sepolia.',
  },
};

/**
 * Landing page (Lovable port, 2026-05-28).
 * Single-route dual-render: MobileLanding for ≤768px, the full
 * desktop tree for the rest. CSS media query in globals.css drives
 * the visibility switch via `.atrium-mobile-only` / `.atrium-desktop-only`.
 */
export default function LandingPage() {
  return (
    <>
      <div className="atrium-mobile-only"><MobileLanding /></div>
      <div className="atrium-desktop-only min-h-screen">
        <PublicNav heroId="hero" />

        {/* ============== HERO MONUMENT ============== */}
        <section id="hero" className="hero-monument">
          <BlueprintGrid />
          <Vignette />
          <div className="hero-monument-inner">
            <div className="hero-monument-top rise">
              <div className="hero-eyebrow-clean">
                <span className="hairline-rule" />
                <span className="pulse-amber" />
                <span className="eyebrow-text">Prime brokerage · Unified margin · Testnet</span>
                <span className="pulse-amber" />
                <span className="hairline-rule" />
              </div>
              <h1 className="hero-monument-h">
                One wallet. Every venue.
                <br />
                <span className="hero-light">One buying-power&nbsp;number.</span>
              </h1>
            </div>

            <div className="hero-impluvium-wrap rise d2 mx-auto w-full max-w-[1100px]">
              <div className="impluvium-dark">
                <Impluvium initialLeverage={3} />
              </div>
            </div>

            <div className="hero-monument-bot rise d3">
              <div className="hero-cta-dark">
                <Link href="/app" className="btn light">
                  Open testnet <span className="arrow">↗</span>
                </Link>
                <Link href="/verify" className="btn ghost-light">
                  View verifier walk →
                </Link>
              </div>
              <div className="hero-trust-dark">
                <span><span className="td" />Arbitrum Sepolia</span>
                <span><span className="td" />Chainlink CCIP</span>
                <span><span className="td" />ERC-8004</span>
                <span><span className="td" />ERC-4337 · 7702</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============== ONE PARAGRAPH PITCH ============== */}
        <section className="section">
          <div className="container">
            <SectionHead
              num="I"
              title={<>The pitch, in one paragraph.</>}
              sub="A trader who only uses one venue does not need Atrium. The pitch only makes sense if you trade across two or more."
            />
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <div className="cap">Without Atrium</div>
                <p className="mt-3 text-[15px] leading-[1.65] text-[var(--ink-soft)]">
                  Post collateral on Hyperliquid for your perp. Post collateral on Aave for
                  your lending. Post collateral on Pendle for your yield. The venues don&apos;t
                  know about each other — every one demands full margin. Your money is
                  split across four sandboxes. If one congests, you withdraw, bridge, and
                  redeposit by hand.
                </p>
              </Card>
              <Card>
                <div className="cap">With Atrium</div>
                <p className="mt-3 text-[15px] leading-[1.65] text-[var(--ink-soft)]">
                  Deposit USDC once. Open positions across the same venues. Plinth sees
                  the whole portfolio at once and nets the hedge. Collateral that would
                  have been double-locked is free to back a third trade. If a venue
                  fails, your money stays in the vault. One dashboard.
                </p>
              </Card>
            </div>
            <p className="mt-10 text-center text-[clamp(24px,3vw,40px)] font-medium leading-tight tracking-[-0.018em] text-[var(--ink)]">
              Less capital locked. Risks made visible.
            </p>
          </div>
        </section>

        {/* ============== VENUES ============== */}
        <section className="section" id="portfolio">
          <div className="container">
            <SectionHead
              num="II"
              title={<>Eight venues. One margin engine.</>}
              sub="Live testnet adapters today. RH-Chain ships within 14 days of the Robinhood SDK going public."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {VENUES.map((v) => (
                <Card key={v.id} dense className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[14px] font-medium text-[var(--ink)]">
                        {v.name}
                      </div>
                      <div className="mono mt-1 text-[10.5px] uppercase tracking-[0.1em] text-[var(--muted)]">
                        {v.short}
                      </div>
                    </div>
                    {v.pending ? <Tag variant="amber">Pending</Tag> : <Tag variant="green">Live</Tag>}
                  </div>
                  <div className="text-[13px] text-[var(--ink-soft)]">{v.type}</div>
                  <div className="hairline" />
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="cap">Test collateral</div>
                      <div className="num mt-1 text-[16px] font-medium text-[var(--ink)]">
                        {v.pending ? '—' : fmtUSD(v.collateral, { compact: true })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="cap">Chain</div>
                      <div className="mono mt-1 text-[11px] text-[var(--ink-soft)]">{v.chain}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ============== FEATURE MOCKS ============== */}
        <Feature
          id="portfolio-feature"
          eyebrow="Plinth · margin engine"
          title="Capital efficiency,"
          accent="mathematically."
          sub="Plinth computes a SPAN-style cross-product margin number in Rust, deployed as Stylus. The same math costs 10–100× more gas in equivalent Solidity."
        >
          <PortfolioMock />
        </Feature>

        <Feature
          id="bridge"
          eyebrow="Aqueduct · Chainlink CCIP"
          title="Move collateral between chains in"
          accent="one transaction."
          sub="Aqueduct routes assets through Chainlink CCIP. Collateral on Robinhood Chain becomes Plinth credit on Arbitrum in under ten seconds."
        >
          <AqueductMock />
        </Feature>

        <Feature
          id="agents-feature"
          dark
          eyebrow="Sigil · ERC-8004 mandates"
          title="Agents trade with"
          accent="bounded mandates."
          sub="You sign one Intent Sigil — an EIP-712 mandate authorising one agent, for one strategy, for a finite window. Postern issues a session key. Your master key never moves."
        >
          <SigilMock />
        </Feature>

        <Feature
          id="reserves"
          eyebrow="Lantern · proof-of-reserves"
          title="Every dollar,"
          accent="on the public record."
          sub="Lantern publishes a signed Merkle attestation every sixty minutes. Anyone can verify a balance against it locally — without trusting Atrium."
        >
          <LanternMock />
        </Feature>

        <Numbers />
        <FloorPlanSection />

        {/* ============== SUBSYSTEMS ============== */}
        <section className="section" id="system">
          <div className="container">
            <SectionHead
              num="III"
              title={<>The system, named.</>}
              sub="Seventeen subsystems and Postern, all trademark-checked, all testnet-buildable in Year 1."
            />
            <div className="grid gap-px overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2 lg:grid-cols-3">
              {SUBSYSTEMS.map((s) => (
                <div key={s.num} className="bg-[var(--bg-raised)] p-5">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--muted)]">
                        {s.num}
                      </div>
                      <div className="mt-1 text-[20px] font-medium leading-none tracking-[-0.018em] text-[var(--ink)]">
                        {s.name}
                      </div>
                      <div className="mt-1 text-[13px] text-[var(--ink-soft)]">{s.sub}</div>
                    </div>
                    <Tag variant={s.phase === 'P1' ? 'green' : 'amber'}>{s.phase}</Tag>
                  </div>
                  <div className="mono mt-4 text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    {s.stack}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============== AGENTS ============== */}
        <section
          className="section"
          id="agents"
          style={{ background: 'var(--dark-bg)', color: 'var(--dark-ink)' }}
        >
          <div className="container">
            <div className="grid items-end gap-10 md:grid-cols-[1fr_360px] md:gap-16">
              <div>
                <div className="mono mb-6 text-[11px] uppercase tracking-[0.18em] text-[color:color-mix(in_oklch,var(--dark-ink)_60%,transparent)]">
                  Sigil · agent credit
                </div>
                <h2 className="text-[clamp(32px,4.4vw,56px)] font-medium leading-[1.06] tracking-[-0.025em]">
                  Hand a fixed budget to an AI agent.
                  <br />
                  <span style={{ color: 'color-mix(in oklch, var(--dark-ink) 70%, transparent)' }}>
                    Pull the plug on every agent <span className="text-accent">in the hand</span>.
                  </span>
                </h2>
                <p className="mt-5 max-w-xl text-[15px] leading-[1.6]" style={{ color: 'color-mix(in oklch, var(--dark-ink) 75%, transparent)' }}>
                  Sigil writes EIP-712 mandates over ERC-8004: per-action cap, daily-loss
                  cap, venue allowlist, expiry. The kill switch revokes every mandate and
                  cancels every active session key for your wallet in one signature.
                </p>
                <div className="mt-8 flex gap-3">
                  <Link href="/app" className="btn light">Open the marketplace</Link>
                  <Link href="/docs" className="btn ghost-light">Read the spec →</Link>
                </div>
              </div>
              <div className="rounded-[16px] border p-6"
                style={{
                  borderColor: 'color-mix(in oklch, var(--dark-ink) 14%, transparent)',
                  background: 'color-mix(in oklch, var(--dark-ink) 4%, transparent)',
                }}>
                <div className="mono text-[10.5px] uppercase tracking-[0.14em]"
                  style={{ color: 'color-mix(in oklch, var(--dark-ink) 55%, transparent)' }}>
                  Mandate preview
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                  <div style={{ color: 'color-mix(in oklch, var(--dark-ink) 55%, transparent)' }}>Agent</div>
                  <div className="mono">augur.atrium.eth</div>
                  <div style={{ color: 'color-mix(in oklch, var(--dark-ink) 55%, transparent)' }}>Per action</div>
                  <div className="mono">12 USDC</div>
                  <div style={{ color: 'color-mix(in oklch, var(--dark-ink) 55%, transparent)' }}>Daily loss</div>
                  <div className="mono">25 USDC</div>
                  <div style={{ color: 'color-mix(in oklch, var(--dark-ink) 55%, transparent)' }}>Expiry</div>
                  <div className="mono">7d</div>
                  <div style={{ color: 'color-mix(in oklch, var(--dark-ink) 55%, transparent)' }}>Intent</div>
                  <div className="mono">0xeb14…77c1</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============== TRUST STRIP ============== */}
        <section className="border-y border-[var(--hairline)]">
          <div className="container py-10">
            <div className="cap mb-5 text-center">Building with</div>
            <div className="mono flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-[12.5px] text-[var(--ink-soft)]">
              {PARTNERS.map((p) => (
                <span key={p}>{p}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ============== FINAL CTA ============== */}
        <section className="section" style={{ background: 'var(--dark-bg)' }}>
          <div className="container text-center" style={{ color: 'var(--dark-ink)' }}>
            <h2 className="mx-auto max-w-3xl text-[clamp(36px,5vw,72px)] font-medium leading-[1.04] tracking-[-0.028em]">
              <span className="text-accent">Less capital locked.</span>
              <br />
              Risks made visible.
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/app" className="btn light lg">Open testnet ↗</Link>
              <Link href="/verify" className="btn ghost-light lg">See how it works</Link>
            </div>
            <div className="mono mt-8 text-[11px] uppercase tracking-[0.14em]"
              style={{ color: 'color-mix(in oklch, var(--dark-ink) 50%, transparent)' }}>
              Testnet only · not investment advice
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
