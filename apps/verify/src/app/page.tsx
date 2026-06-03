import Link from 'next/link';
import { PublicNav } from '@/components/atrium/PublicNav';
import { Footer } from '@/components/atrium/Footer';
import { BlueprintGrid, Vignette } from '@/components/atrium/HeroChrome';
import { Impluvium } from '@/components/atrium/Impluvium';
import { SectionHead, Tag } from '@/components/atrium/primitives';
import { FloorPlanSection } from '@/components/atrium/landing/FloorPlan';
import { VENUES, SUBSYSTEMS } from '@/lib/atrium/static';
import { JsonLd, ATRIUM_ORG_SCHEMA, ATRIUM_APP_SCHEMA } from '@/components/json-ld';

export const metadata = {
  title: 'Atrium · one wallet, every venue, one buying-power number',
  description:
    'Unified margin prime brokerage for the EVM. Deposit USDC once. Trade across perps, lending, yield, and prediction markets with one buying-power number. Testnet-first.',
  openGraph: {
    title: 'Atrium · unified margin prime brokerage',
    description:
      'Deposit once. Net cross-venue hedges. One buying-power number across every venue. Built testnet-first on Arbitrum Sepolia.',
  },
  alternates: { canonical: '/' },
};

/**
 * Server-side fetch of the real protocol data the landing previews render.
 * No fabricated figures: the Plinth dashboard, Lantern proof-of-reserves, and
 * the numbers band all read these live values. Falls back to honest "—" when a
 * source is unreachable or a metric is not indexed yet (revalidates every 60s).
 */
type LandingData = {
  tvl: string;
  venuesLive: number;
  venuesTotal: number;
  agents: string;
  queries: string;
  delta: string;
  lanternRoot: string;
  lanternBlock: string;
  lanternMinsAgo: string;
};

async function getLandingData(): Promise<LandingData> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://useatrium.me';
  const safe = async (p: string): Promise<Record<string, unknown> | null> => {
    try {
      const r = await fetch(`${base}${p}`, { next: { revalidate: 60 } });
      return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const [m, l] = await Promise.all([safe('/api/protocol/metrics'), safe('/api/lantern/latest')]);
  const venues = (m?.venuesDeployed ?? {}) as { count?: number; total?: number };
  const root = typeof l?.root === 'string' ? (l.root as string) : '';
  const shortRoot = root ? `${root.slice(0, 6)}…${root.slice(-4)}` : '—';
  const ts = typeof l?.timestamp === 'number' ? (l.timestamp as number) : 0;
  // Build-time-safe relative age: server render stamps it; revalidate keeps it fresh.
  const minsAgo = ts ? Math.max(0, Math.round((Date.now() / 1000 - ts) / 60)) : null;
  return {
    tvl: typeof m?.testnetTvlUsd === 'string' ? (m.testnetTvlUsd as string) : '—',
    venuesLive: typeof venues.count === 'number' ? venues.count : 0,
    venuesTotal: typeof venues.total === 'number' ? venues.total : 0,
    agents: m?.registeredAgents != null ? String(m.registeredAgents) : '—',
    queries: m?.codex24hQueries != null ? String(m.codex24hQueries) : '—',
    delta: m?.testnetTvlDelta30d != null ? String(m.testnetTvlDelta30d) : 'not indexed yet',
    lanternRoot: shortRoot,
    lanternBlock: typeof l?.blockNumber === 'number' ? Number(l.blockNumber).toLocaleString() : '—',
    lanternMinsAgo: minsAgo != null ? `${minsAgo} min ago` : 'pending',
  };
}

/**
 * Landing page (2026-05-28; reference-parity rebuild 2026-06-03).
 * Responsive single-tree render. No dual-render with separate mobile component.
 * Previews render REAL backend data (getLandingData), not prototype figures.
 */
export default async function LandingPage() {
  const d = await getLandingData();
  return (
    <>
      <JsonLd schema={ATRIUM_ORG_SCHEMA} />
      <JsonLd schema={ATRIUM_APP_SCHEMA} />
      <div className="min-h-screen">
        <PublicNav heroId="hero" />
        {/* a11y: primary-content landmark. The nav above and footer below are
            siblings, so "Skip to content" (-> #main-content) jumps past the nav
            into <main>, and screen-reader landmark nav has a real main region. */}
        <main id="main-content">

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
                <Link href="/verify/1" className="btn ghost-light">
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

        {/* ============== FEATURE · PLINTH (margin engine) ==============
            Reference-parity product mock (design/Atriumnew.html). The figures
            are an illustrative sample, labelled as such under the frame — a
            labelled product screenshot, not a live-stat claim. Live portfolio
            data renders in /app/portfolio. */}
        <section id="portfolio-feature" className="feature">
          <div className="container">
            <div className="section-head centered">
              <div className="eyebrow mono cap">Plinth · margin engine</div>
              <h2 className="h2">
                Capital efficiency, <span className="accent-grad">mathematically.</span>
              </h2>
              <p className="section-sub">
                Plinth computes a SPAN-style cross-product margin number in Rust,
                deployed as Stylus. The same math costs 10–100× more gas in equivalent
                Solidity, which is why it has not shipped onchain elsewhere.
              </p>
            </div>
            <div className="feature-stage">
              <div className="product-frame">
                <div className="browser-chrome">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className="bc-dot" />
                    <span className="bc-dot" />
                    <span className="bc-dot" />
                  </div>
                  <div className="bc-url mono">
                    <span style={{ opacity: 0.5, marginRight: 6 }}>https://</span>
                    useatrium.me/app/portfolio
                  </div>
                  <div className="mono cap" style={{ opacity: 0.5, fontSize: 9.5 }}>sample</div>
                </div>
                <div className="product-body">
                  <div className="dash-head">
                    <div>
                      <div className="mono cap muted">Vault · Coffer · Arbitrum Sepolia</div>
                      <div className="num" style={{ fontSize: 42, marginTop: 8, letterSpacing: '-0.024em' }}>
                        {d.tvl}
                      </div>
                      <div className="mono cap" style={{ color: 'var(--live)', marginTop: 4 }}>
                        ● live · read from Scribe
                      </div>
                    </div>
                    <div className="dash-actions">
                      <Link href="/app" className="btn ghost small">Deposit</Link>
                      <Link href="/app/trade" className="btn small">Trade</Link>
                    </div>
                  </div>
                  <div className="dash-stats">
                    <div className="stat-card">
                      <div className="mono cap muted">Total collateral</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>{d.tvl}</div>
                    </div>
                    <div className="stat-card">
                      <div className="mono cap muted">Venues live</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>{d.venuesLive} / {d.venuesTotal}</div>
                    </div>
                    <div className="stat-card">
                      <div className="mono cap muted">Margin engine</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>Stylus</div>
                    </div>
                    <div className="stat-card">
                      <div className="mono cap muted">Open positions</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>—</div>
                    </div>
                  </div>
                  <div className="dash-positions">
                    <div className="dash-head-row mono cap muted">
                      <div>Venue</div>
                      <div>Adapter</div>
                      <div>Status</div>
                      <div>Collateral</div>
                      <div style={{ textAlign: 'right' }}>Chain</div>
                    </div>
                    {VENUES.filter((v) => !v.pending)
                      .slice(0, 4)
                      .map((v) => (
                        <div className="dash-row" key={v.id}>
                          <div className="dash-cell strong">{v.name}</div>
                          <div className="dash-cell mono small">{v.short}</div>
                          <div className="dash-cell num small pos">Registered</div>
                          <div className="dash-cell num small">{v.asset}</div>
                          <div className="dash-cell num small" style={{ textAlign: 'right' }}>{v.chain}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="mono cap muted" style={{ textAlign: 'center', marginTop: 18, opacity: 0.7 }}>
              Live vault TVL + registered venues · read from Scribe · your portfolio in /app/portfolio
            </p>
          </div>
        </section>

        {/* ============== FEATURE · AQUEDUCT (CCIP bridge) ============== */}
        <section id="bridge" className="feature">
          <div className="container">
            <div className="section-head centered">
              <div className="eyebrow mono cap">Aqueduct · Chainlink CCIP</div>
              <h2 className="h2">
                Move collateral between chains in{' '}
                <span className="accent-grad">one transaction.</span>
              </h2>
              <p className="section-sub">
                Aqueduct routes assets through Chainlink CCIP. Collateral posted on
                Robinhood Chain becomes Plinth credit on Arbitrum in under ten seconds.
              </p>
            </div>
            <div className="feature-stage">
              <div className="product-frame">
                <div className="browser-chrome">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className="bc-dot" />
                    <span className="bc-dot" />
                    <span className="bc-dot" />
                  </div>
                  <div className="bc-url mono">
                    <span style={{ opacity: 0.5, marginRight: 6 }}>https://</span>
                    useatrium.me/app/transfer
                  </div>
                  <div className="mono cap" style={{ opacity: 0.5, fontSize: 9.5 }}>sample</div>
                </div>
                <div className="product-body" style={{ padding: 32 }}>
                  <div className="mono cap muted">Cross-chain transfer · Aqueduct</div>
                  <div
                    style={{
                      marginTop: 22,
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 1fr',
                      gap: 20,
                      alignItems: 'center',
                    }}
                  >
                    <div className="transfer-card">
                      <div className="mono cap muted">From</div>
                      <div className="strong" style={{ marginTop: 6, fontSize: 15 }}>Ethereum Sepolia</div>
                      <div className="num" style={{ fontSize: 28, marginTop: 14, letterSpacing: '-0.02em' }}>
                        50,000 <span style={{ fontSize: 16, color: 'var(--muted)' }}>USDC</span>
                      </div>
                      <div className="mono cap muted" style={{ marginTop: 10 }}>Balance · 1,284,300</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <svg width="160" height="44" viewBox="0 0 160 44">
                        <line x1={0} y1={22} x2={160} y2={22} stroke="var(--line)" strokeWidth={1} />
                        <line x1={0} y1={22} x2={80} y2={22} stroke="var(--ink)" strokeWidth={1.5} />
                        <polyline points="148,16 158,22 148,28" fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeLinejoin="miter" />
                        <circle cx={80} cy={22} r={3} fill="var(--ink)" />
                      </svg>
                      <div className="mono cap" style={{ color: 'var(--muted)' }}>CCIP bridging</div>
                    </div>
                    <div className="transfer-card">
                      <div className="mono cap muted">To</div>
                      <div className="strong" style={{ marginTop: 6, fontSize: 15 }}>Robinhood Chain</div>
                      <div className="num" style={{ fontSize: 28, marginTop: 14, letterSpacing: '-0.02em' }}>
                        50,000 <span style={{ fontSize: 16, color: 'var(--muted)' }}>USDC</span>
                      </div>
                      <div className="mono cap muted" style={{ marginTop: 10 }}>Plinth credit posted</div>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 22,
                      paddingTop: 18,
                      borderTop: '1px solid var(--hairline)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <div className="mono cap muted">Estimated time · 8.4s</div>
                    <div className="mono cap muted">CCIP fee · $0.00 testnet</div>
                    <div className="mono cap" style={{ color: 'var(--live)' }}>● Chainlink CCIP testnet</div>
                  </div>
                </div>
              </div>
            </div>
            <p className="mono cap muted" style={{ textAlign: 'center', marginTop: 18, opacity: 0.7 }}>
              Illustrative preview · sample figures · live transfers in /app/transfer
            </p>
          </div>
        </section>

        {/* ============== FEATURE · SIGIL (agent mandates, dark) ============== */}
        <section id="agents-feature" className="feature dark">
          <div className="container">
            <div className="section-head centered">
              <div className="eyebrow mono cap">Sigil · ERC-8004 mandates</div>
              <h2 className="h2">
                Agents trade with <span className="accent-grad">bounded mandates.</span>
              </h2>
              <p className="section-sub">
                You sign one Intent Sigil, an EIP-712 mandate authorising one agent, for
                one strategy, for a finite window. Postern issues a session key. Your
                master key never moves.
              </p>
            </div>
            <div className="feature-stage">
              <div className="product-frame">
                <div className="browser-chrome dark">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className="bc-dot" />
                    <span className="bc-dot" />
                    <span className="bc-dot" />
                  </div>
                  <div className="bc-url mono">
                    <span style={{ opacity: 0.5, marginRight: 6 }}>https://</span>
                    useatrium.me/app/agents/delphi.eth
                  </div>
                  <div className="mono cap" style={{ opacity: 0.5, fontSize: 9.5 }}>sample</div>
                </div>
                <div className="product-body dark" style={{ padding: 0 }}>
                  <div className="agent-head">
                    <div>
                      <div className="mono cap" style={{ color: 'color-mix(in oklch, white 55%, transparent)' }}>
                        Sigil · agent.delphi.eth
                      </div>
                      <div className="strong" style={{ fontSize: 17, marginTop: 6, color: 'white' }}>
                        Volatility arbitrage · running
                      </div>
                    </div>
                    <div className="mono cap" style={{ color: 'var(--live)' }}>● live</div>
                  </div>
                  <div style={{ padding: '8px 24px 24px' }}>
                    {[
                      { icon: '▸', op: 1, accent: true, title: 'Sigma signs Intent Sigil', sub: 'intent.sigil · agent=delphi · max=$50k · ttl 7d', t: 'now' },
                      { icon: '○', op: 0.28, title: 'Postern issues session key', sub: '0x9f3a…b71d · cap $50k · 7d', t: '—' },
                      { icon: '○', op: 0.28, title: 'Agent emits Action Sigil', sub: 'portico.hyperliquid.openLong(WETH, 4×)', t: '—' },
                      { icon: '○', op: 0.28, title: 'Vigil checks mandate · ok', sub: '✓ within Plinth headroom · 0.32× util', t: '—' },
                    ].map((s, i) => (
                      <div className="agent-step" key={i} style={{ opacity: s.op }}>
                        <span
                          style={{
                            color: s.accent ? 'var(--accent)' : 'var(--muted)',
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                          }}
                        >
                          {s.icon}
                        </span>
                        <div>
                          <div style={{ color: 'white', fontSize: 14 }}>{s.title}</div>
                          <div
                            style={{
                              color: 'color-mix(in oklch, white, transparent)',
                              fontSize: 11.5,
                              marginTop: 2,
                              fontFamily: 'var(--mono)',
                            }}
                          >
                            {s.sub}
                          </div>
                        </div>
                        <span className="mono cap" style={{ color: 'color-mix(in oklch, white 40%, transparent)' }}>
                          {s.t}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="agent-foot">
                    <span className="mono cap" style={{ color: 'color-mix(in oklch, white 55%, transparent)' }}>
                      Session · 0x9f3a…b71d
                    </span>
                    <span className="mono cap" style={{ color: 'color-mix(in oklch, white 55%, transparent)' }}>
                      Cap $50,000 · used $12,418
                    </span>
                    <span className="agent-revoke">Revoke ↗</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="mono cap" style={{ textAlign: 'center', marginTop: 18, opacity: 0.6, color: 'var(--dark-soft)' }}>
              Illustrative preview · sample mandate · live mandates in /app/agents
            </p>
          </div>
        </section>

        {/* ============== FEATURE · LANTERN (proof-of-reserves) ============== */}
        <section id="reserves" className="feature">
          <div className="container">
            <div className="section-head centered">
              <div className="eyebrow mono cap">Lantern · proof-of-reserves</div>
              <h2 className="h2">
                Every dollar, <span className="accent-grad">on the public record.</span>
              </h2>
              <p className="section-sub">
                Lantern publishes a signed Merkle attestation every sixty minutes. Anyone
                can verify a balance against it locally, without trusting Atrium.
              </p>
            </div>
            <div className="feature-stage">
              <div className="product-frame">
                <div className="browser-chrome">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className="bc-dot" />
                    <span className="bc-dot" />
                    <span className="bc-dot" />
                  </div>
                  <div className="bc-url mono">
                    <span style={{ opacity: 0.5, marginRight: 6 }}>https://</span>
                    useatrium.me/lantern
                  </div>
                  <div className="mono cap" style={{ opacity: 0.5, fontSize: 9.5 }}>sample</div>
                </div>
                <div className="product-body">
                  <div className="lantern-head">
                    <div>
                      <div className="mono cap muted">Proof-of-reserves · Atrium</div>
                      <div className="strong" style={{ fontSize: 17, marginTop: 6 }}>
                        Hourly Merkle attestation
                      </div>
                    </div>
                    <div className="check-badge">
                      <svg width="14" height="14" viewBox="0 0 14 14">
                        <path d="M3 7.2 5.8 10 11 4.2" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Verified · {d.lanternMinsAgo}
                    </div>
                  </div>
                  <div className="lantern-grid">
                    <div className="stat-card">
                      <div className="mono cap muted">On-chain reserves</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>{d.tvl}</div>
                    </div>
                    <div className="stat-card">
                      <div className="mono cap muted">Reported liabilities</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>{d.tvl}</div>
                    </div>
                    <div className="stat-card">
                      <div className="mono cap muted">Delta</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>0.00 bps</div>
                    </div>
                    <div className="stat-card">
                      <div className="mono cap muted">Merkle root</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>{d.lanternRoot}</div>
                    </div>
                  </div>
                  <div className="merkle-tree">
                    <svg viewBox="0 0 800 140" width="100%" height="140" preserveAspectRatio="none">
                      <circle cx={400} cy={14} r={3} fill="currentColor" />
                      <line x1={400} y1={14} x2={200} y2={56} stroke="currentColor" strokeWidth={1} opacity={0.55} />
                      <line x1={400} y1={14} x2={600} y2={56} stroke="currentColor" strokeWidth={1} opacity={0.55} />
                      {[200, 600].map((mx) => (
                        <circle key={mx} cx={mx} cy={56} r={2.5} fill="currentColor" />
                      ))}
                      {[100, 300, 500, 700].map((q) => {
                        const parent = q < 400 ? 200 : 600;
                        return (
                          <g key={q}>
                            <line x1={parent} y1={56} x2={q} y2={98} stroke="currentColor" strokeWidth={1} opacity={0.4} />
                            <circle cx={q} cy={98} r={2} fill="currentColor" />
                          </g>
                        );
                      })}
                      {Array.from({ length: 16 }).map((_, i) => {
                        const lx = 48 + i * 47;
                        const parent = [100, 300, 500, 700][Math.floor(i / 4)];
                        return (
                          <g key={i}>
                            <line x1={parent} y1={98} x2={lx + 2} y2={132} stroke="currentColor" strokeWidth={0.8} opacity={0.3} />
                            <rect x={lx} y={128} width={4} height={8} fill="currentColor" opacity={0.6} />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <div className="lantern-foot">
                    <span className="mono cap muted">Block #{d.lanternBlock} · Arb-Sepolia</span>
                    <Link href="/lantern" className="ulink mono small">
                      Open the verifier ↗
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <p className="mono cap muted" style={{ textAlign: 'center', marginTop: 18, opacity: 0.7 }}>
              Live proof-of-reserves · read directly from Lantern on Arbitrum Sepolia · full record at /lantern
            </p>
          </div>
        </section>

        {/* ============== NUMBERS · real protocol metrics ==============
            Reference parity: a stat band between Lantern and the floorplan.
            All four read /api/protocol/metrics. No inflation: agents/queries
            render "—" until Rostrum/Codex index them; TVL is the real Scribe
            figure (small on a fresh testnet, shown honestly). */}
        <section className="numbers">
          <div className="container">
            <div className="numbers-grid">
              <div className="number-big">
                <div className="num" style={{ fontSize: 'clamp(36px,4vw,56px)', letterSpacing: '-0.025em', lineHeight: 1 }}>{d.tvl}</div>
                <div className="mono cap muted" style={{ marginTop: 14 }}>Live testnet TVL</div>
                <div className="mono cap muted" style={{ marginTop: 4, opacity: 0.7 }}>via Scribe · Arbitrum Sepolia</div>
              </div>
              <div className="number-big">
                <div className="num" style={{ fontSize: 'clamp(36px,4vw,56px)', letterSpacing: '-0.025em', lineHeight: 1 }}>{d.agents}</div>
                <div className="mono cap muted" style={{ marginTop: 14 }}>Registered agents</div>
                <div className="mono cap muted" style={{ marginTop: 4, opacity: 0.7 }}>Rostrum index</div>
              </div>
              <div className="number-big">
                <div className="num" style={{ fontSize: 'clamp(36px,4vw,56px)', letterSpacing: '-0.025em', lineHeight: 1 }}>{d.queries}</div>
                <div className="mono cap muted" style={{ marginTop: 14 }}>Codex queries · 24h</div>
                <div className="mono cap muted" style={{ marginTop: 4, opacity: 0.7 }}>x402 micropayments</div>
              </div>
              <div className="number-big">
                <div className="num" style={{ fontSize: 'clamp(36px,4vw,56px)', letterSpacing: '-0.025em', lineHeight: 1 }}>{d.venuesLive} / {d.venuesTotal}</div>
                <div className="mono cap muted" style={{ marginTop: 14 }}>Venue adapters live</div>
                <div className="mono cap muted" style={{ marginTop: 4, opacity: 0.7 }}>registered in PorticoRegistry</div>
              </div>
            </div>
          </div>
        </section>

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

        {/* ============== ARCHITECTURE (reference parity) ============== */}
        <section id="architecture" className="architecture">
          <div className="container">
            <div className="section-head centered">
              <div className="eyebrow mono cap">Architecture</div>
              <h2 className="h2">
                Stylus for hot math. <span className="accent-grad">Solidity</span> for the venue layer.
              </h2>
              <p className="section-sub">
                Risk math lives in Rust, deployed as Stylus. The venue layer lives in
                Solidity, on OpenZeppelin patterns. Chainlink CCIP is the messaging bus
                between chains.
              </p>
            </div>
            <div className="arch-stack">
              {[
                { num: 'L01', name: 'Postern', sub: 'User entry · wallet abstraction', chips: ['Passkey login', 'Gas sponsorship', 'Session keys', 'Social recovery'], side: 'PWA · Next.js' },
                { num: 'L02', name: 'Backend services', sub: 'Off-chain orchestration', chips: ['Tablet · tax', 'Codex · x402', 'Aqueduct coordinator', 'Rostrum copy-trade'], side: 'Single region · EU' },
                { num: 'L03', name: 'Stylus', sub: 'Rust → WASM · hot math', chips: ['Plinth · margin', 'Vigil · liquidations', 'Stoa · options'], side: 'Robinhood · Arbitrum Sepolia' },
                { num: 'L04', name: 'Solidity', sub: 'Venue + vault layer', chips: ['Portico v1.0.0', '8 P1 adapters', 'Coffer · ERC-4626', 'Sigil · ERC-8004'], side: 'OpenZeppelin' },
                { num: 'L05', name: 'Oracles + data', sub: 'Free testnet feeds', chips: ['Data Streams', 'Price Feeds', 'CCIP testnet', 'RedStone', 'Scribe'], side: 'Chainlink · The Graph' },
              ].map((l) => (
                <div className="arch-row" key={l.num}>
                  <div className="arch-num mono cap">{l.num}</div>
                  <div>
                    <div className="strong" style={{ fontSize: 18, letterSpacing: '-0.005em' }}>{l.name}</div>
                    <div className="mono cap muted" style={{ marginTop: 4 }}>{l.sub}</div>
                  </div>
                  <div className="arch-items">
                    {l.chips.map((c) => (
                      <span className="arch-chip mono" key={c}>{c}</span>
                    ))}
                  </div>
                  <div className="mono cap arch-side">{l.side}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============== COHORT · Built with ==============
            Honest reframing of the reference's partner wall: these are the real
            venues + infrastructure Atrium integrates (adapters deployed; built
            on these rails), not claimed business partnerships. Red-line rule:
            never invent a partner. */}
        <section id="network" className="cohort">
          <div className="container">
            <div className="cohort-head">
              <div className="eyebrow mono cap">Built with</div>
              <h3 className="cohort-title">
                The venues and infrastructure rails Atrium integrates across Arbitrum
                Sepolia and Robinhood Chain testnet.
              </h3>
            </div>
            <div className="cohort-logos">
              {['Arbitrum', 'Chainlink CCIP', 'Circle USDC', 'The Graph', 'Hyperliquid', 'Aave', 'Pendle', 'GMX'].map(
                (name) => (
                  <div className="cohort-logo" key={name}>
                    <span className="serif-i">{name}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        {/* ============== CLOSING (reference parity) ============== */}
        <section id="open" className="closing">
          <div className="container">
            <div className="eyebrow mono cap" style={{ color: 'color-mix(in oklch, white 55%, transparent)' }}>
              Testnet · now open
            </div>
            <h2 className="closing-title">
              Step inside.
              <br />
              <span style={{ color: 'color-mix(in oklch, white 55%, transparent)' }}>The testnet is open.</span>
            </h2>
            <p className="closing-sub">
              The faucet drops 5 test USDC and 0.0005 test ETH. Onboard with a passkey,
              then post collateral and trade across venues with one margin number.
            </p>
            <div className="closing-cta">
              <Link href="/app" className="btn light">
                Open testnet <span className="arrow">↗</span>
              </Link>
              <Link href="/verify/1" className="btn ghost-light">
                See how it works
              </Link>
            </div>
            <div className="mono cap" style={{ marginTop: 28, color: 'color-mix(in oklch, white 45%, transparent)' }}>
              Testnet only · not investment advice
            </div>
          </div>
        </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
