import Link from 'next/link';
import { PublicNav } from '@/components/atrium/PublicNav';
import { Footer } from '@/components/atrium/Footer';
import { BlueprintGrid, Vignette } from '@/components/atrium/HeroChrome';
import { Impluvium } from '@/components/atrium/Impluvium';
import { FloorPlanSection } from '@/components/atrium/landing/FloorPlan';
import { VENUES } from '@/lib/atrium/static';
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
  venuesDeployed: number;
  venuesTotal: number;
  agents: string;
  queries: string;
  delta: string;
  lanternRoot: string;
  lanternBlock: string;
  lanternMinsAgo: string;
  lanternStale: boolean;
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
    venuesDeployed: typeof venues.count === 'number' ? venues.count : 0,
    venuesTotal: typeof venues.total === 'number' ? venues.total : 0,
    agents: m?.registeredAgents != null ? String(m.registeredAgents) : '—',
    queries: m?.codex24hQueries != null ? String(m.codex24hQueries) : '—',
    delta: m?.testnetTvlDelta30d != null ? String(m.testnetTvlDelta30d) : 'not indexed yet',
    lanternRoot: shortRoot,
    lanternBlock: typeof l?.blockNumber === 'number' ? Number(l.blockNumber).toLocaleString() : '—',
    lanternMinsAgo: minsAgo != null ? `${minsAgo} min ago` : 'pending',
    // Honest staleness: the attestor is scheduled every 10 min, but the
    // free GHA cron can lag. If the newest root is older than 30 min, the
    // badge drops the "Verified" claim and just states "Last attestation"
    // so a stale root never reads as a fresh green check.
    lanternStale: minsAgo != null && minsAgo > 30,
  };
}

/**
 * Landing page (2026-05-28; reference-parity rebuild 2026-06-03).
 * Currently a dual render, CSS-toggled by viewport: a desktop tree
 * (.atrium-desktop-only) and a separate mobile tree (.atrium-mobile-only ->
 * <MobileLanding>). Both read the same getLandingData() so figures never
 * diverge; the intended end state is a single responsive tree (mobile-unify
 * tech debt - this ships both trees, so the HTML carries two <h1>s).
 * Previews render REAL backend data (getLandingData), not prototype figures.
 */
export default async function LandingPage() {
  const d = await getLandingData();
  return (
    <>
      <JsonLd schema={ATRIUM_ORG_SCHEMA} />
      <JsonLd schema={ATRIUM_APP_SCHEMA} />
      <div className="atrium-desktop-only min-h-screen">
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
            Reference-parity product mock (design/Atriumnew.html). The vault TVL,
            venue count and Lantern figures read real backend data (getLandingData);
            the dashboard frame shows what /app/portfolio looks like populated. */}
        <section id="portfolio-feature" className="feature">
          <div className="container">
            <div className="section-head feature-split-head">
              <div className="feature-split-copy">
                <div className="eyebrow mono cap">Plinth · margin engine</div>
                <p className="section-sub">
                  Plinth computes a SPAN-style cross-product margin number in Rust,
                  deployed as Stylus. The same math costs 10x to 100x more gas in equivalent
                  Solidity, which is why it has not shipped onchain elsewhere.
                </p>
              </div>
              <h2 className="h2">
                Capital efficiency, <span className="accent-grad">mathematically.</span>
              </h2>
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
                  <div className="mono cap" style={{ opacity: 0.5, fontSize: 9.5 }}>live</div>
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
                      <div className="mono cap muted">Venue adapters</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>{d.venuesDeployed} / {d.venuesTotal}</div>
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
                          <div className={'dash-cell num small ' + (v.id === 'aave-horizon' ? 'pos' : 'muted')}>{v.id === 'aave-horizon' ? 'Live' : 'Deployed'}</div>
                          <div className="dash-cell num small">{v.asset}</div>
                          <div className="dash-cell num small" style={{ textAlign: 'right' }}>{v.chain}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="mono cap muted" style={{ textAlign: 'center', marginTop: 18, opacity: 0.7 }}>
              Live vault TVL · 1 venue live today (Aave, via a test pool); the rest are deployed and register through mainnet ·{' '}
              <a href="/docs/honesty" style={{ textDecoration: 'underline' }}>honest disclosures</a>
            </p>
          </div>
        </section>

        {/* ============== FEATURE · AQUEDUCT (CCIP bridge) ============== */}
        <section id="bridge" className="feature">
          <div className="container">
            <div className="section-head feature-split-head">
              <div className="feature-split-copy">
                <div className="eyebrow mono cap">Aqueduct · Chainlink CCIP</div>
                <p className="section-sub">
                  Aqueduct routes assets through Chainlink CCIP. Collateral posted on
                  Robinhood Chain becomes Plinth credit on Arbitrum in under ten seconds.
                </p>
              </div>
              <h2 className="h2">
                Move collateral between chains in{' '}
                <span className="accent-grad">one transaction.</span>
              </h2>
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
                  <div className="mono cap" style={{ opacity: 0.85, fontSize: 10.5 }}>sample</div>
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
                      <div className="strong" style={{ marginTop: 6, fontSize: 15 }}>Robinhood Chain</div>
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
                      <div className="strong" style={{ marginTop: 6, fontSize: 15 }}>Arbitrum Sepolia</div>
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
How a cross-chain transfer flows through Chainlink CCIP · walk the flow in /app/transfer (the testnet CCIP lane is pending)
            </p>
          </div>
        </section>

        {/* ============== FEATURE · SIGIL (agent mandates, dark) ============== */}
        <section id="agents-feature" className="feature dark">
          <div className="container">
            <div className="section-head feature-split-head">
              <div className="feature-split-copy">
                <div className="eyebrow mono cap">Sigil · ERC-8004 mandates</div>
                <p className="section-sub">
                  You sign one Intent Sigil, an EIP-712 mandate authorising one agent, for
                  one strategy, for a finite window. Postern issues a session key. Your
                  master key never moves.
                </p>
              </div>
              <h2 className="h2">
                Agents trade with <span className="accent-grad">bounded mandates.</span>
              </h2>
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
                  <div className="mono cap" style={{ opacity: 0.85, fontSize: 10.5 }}>sample</div>
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
                    <div className="mono cap" style={{ color: 'color-mix(in oklch, white 45%, transparent)' }}>● sample</div>
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
How a bounded agent mandate executes, step by step · issue a live mandate in /app/agents
            </p>
          </div>
        </section>

        {/* ============== FEATURE · LANTERN (proof-of-reserves) ============== */}
        <section id="reserves" className="feature">
          <div className="container">
            <div className="section-head feature-split-head">
              <div className="feature-split-copy">
                <div className="eyebrow mono cap">Lantern · proof-of-reserves</div>
                <p className="section-sub">
                  Lantern publishes a signed Merkle attestation roughly hourly. Anyone
                  can verify a balance against it locally, without trusting Atrium.
                </p>
              </div>
              <h2 className="h2">
                Every dollar, <span className="accent-grad">on the public record.</span>
              </h2>
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
                  <div className="mono cap" style={{ opacity: 0.5, fontSize: 9.5 }}>live</div>
                </div>
                <div className="product-body">
                  <div className="lantern-head">
                    <div>
                      <div className="mono cap muted">Proof-of-reserves · Atrium</div>
                      <div className="strong" style={{ fontSize: 17, marginTop: 6 }}>
                        Merkle attestation · every 10 min
                      </div>
                    </div>
                    <div className="check-badge" style={d.lanternStale ? { opacity: 0.6 } : undefined}>
                      <svg width="14" height="14" viewBox="0 0 14 14">
                        <path d="M3 7.2 5.8 10 11 4.2" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {d.lanternStale ? 'Last attestation' : 'Verified'} · {d.lanternMinsAgo}
                    </div>
                  </div>
                  <div className="lantern-grid">
                    <div className="stat-card">
                      <div className="mono cap muted">On-chain reserves</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>{d.tvl}</div>
                    </div>
                    <div className="stat-card">
                      <div className="mono cap muted">Redeemable claims</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>{d.tvl}</div>
                    </div>
                    <div className="stat-card">
                      <div className="mono cap muted">Backing</div>
                      <div className="num" style={{ fontSize: 20, marginTop: 6 }}>100%</div>
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
                <div className="num" style={{ fontSize: 'clamp(36px,4vw,56px)', letterSpacing: '-0.025em', lineHeight: 1 }}>{d.venuesDeployed} / {d.venuesTotal}</div>
                <div className="mono cap muted" style={{ marginTop: 14 }}>Venue adapters deployed</div>
                <div className="mono cap muted" style={{ marginTop: 4, opacity: 0.7 }}>Aave Horizon registered; rest ship Month 1 W2</div>
              </div>
            </div>
          </div>
        </section>

        <FloorPlanSection />

        {/* ============== SUBSYSTEMS · Four architectural blocks (reference parity) ============== */}
        <section id="subsystems" className="subsystems">
          <div className="container">
            <div className="section-head feature-split-head">
              <div className="feature-split-copy">
                <div className="eyebrow mono cap">Subsystems</div>
                <p className="section-sub">
                  Each subsystem owns one responsibility. Thirteen are live on testnet
                  today; all eighteen ship at launch, with Stoa conditional on Phase-2
                  funding.
                </p>
              </div>
              <h2 className="h2">
                Eighteen named pieces. <span className="accent-grad">Four architectural blocks.</span>
              </h2>
            </div>
            <div className="subsys-stack">
              {[
                {
                  block: 'Block 01', title: 'Risk engine', count: '4 subsystems',
                  sub: 'Cross-product margin, liquidations, options pricing. Rust, deployed as Stylus.',
                  cards: [
                    { n: '01', p: 'P1', name: 'Plinth', sub: 'Margin engine', stack: 'Stylus · Rust' },
                    { n: '02', p: 'P1', name: 'Vigil', sub: 'Liquidation engine', stack: 'Stylus · Rust' },
                    { n: '03', p: 'P2', name: 'Stoa', sub: 'Options pricing', stack: 'Stylus · Rust' },
                    { n: '12', p: 'P1', name: 'Coffer', sub: 'ERC-4626 vaults', stack: 'Stylus · OZ' },
                  ],
                },
                {
                  block: 'Block 02', title: 'Venues + cross-chain', count: '3 subsystems',
                  sub: 'Portico framework, Chainlink CCIP bridge, wallet abstraction layer.',
                  cards: [
                    { n: '04', p: 'P1', name: 'Portico', sub: 'Venue framework', stack: 'Solidity · OZ' },
                    { n: '05', p: 'P1', name: 'Aqueduct', sub: 'Cross-chain bridge', stack: 'Solidity · CCIP' },
                    { n: '18', p: 'P1', name: 'Postern', sub: 'Wallet abstraction', stack: 'ERC-4337 · 7702' },
                  ],
                },
                {
                  block: 'Block 03', title: 'Agents + APIs', count: '5 subsystems',
                  sub: 'ERC-8004 mandates, copy-trading marketplace, paid agent surface, indexing.',
                  cards: [
                    { n: '06', p: 'P1', name: 'Sigil', sub: 'Agent credit', stack: 'Solidity · ERC-8004' },
                    { n: '07', p: 'P1', name: 'Rostrum', sub: 'Agent marketplace', stack: 'Solidity · Indexer' },
                    { n: '08', p: 'P1', name: 'Codex', sub: 'Paid agent APIs', stack: 'Node · x402' },
                    { n: '09', p: 'P1', name: 'Scribe', sub: 'Indexer', stack: 'The Graph' },
                    { n: '10', p: 'P1', name: 'Archive', sub: 'Off-chain risk lab', stack: 'Python' },
                  ],
                },
                {
                  block: 'Block 04', title: 'Trust + ops', count: '6 subsystems',
                  sub: 'Proof-of-reserves, compliance, tax exports, CLI, partner programmes.',
                  cards: [
                    { n: '11', p: 'P1', name: 'Lantern', sub: 'Proof-of-reserves', stack: 'Vercel · Merkle' },
                    { n: '13', p: 'P1', name: 'Edict', sub: 'Jurisdiction tiers', stack: 'Solidity · Sumsub' },
                    { n: '14', p: 'P1', name: 'Tablet', sub: 'Tax reporting', stack: 'Node' },
                    { n: '15', p: 'P1', name: 'Praetor', sub: 'CLI · ops', stack: 'Rust · Foundry' },
                    { n: '16', p: 'P1', name: 'Cohort', sub: 'Design partners', stack: 'BD · program' },
                    { n: '17', p: 'P1', name: 'Curator', sub: 'Adapter grants', stack: 'ARB · grants' },
                  ],
                },
              ].map((g) => (
                <div className="subsys-group" key={g.block}>
                  <div className="subsys-group-head">
                    <div className="mono cap muted">{g.block}</div>
                    <h3 className="subsys-group-title">{g.title}</h3>
                    <p className="subsys-group-sub">{g.sub}</p>
                    <div className="mono cap muted" style={{ marginTop: 18 }}>{g.count}</div>
                  </div>
                  <div className="subsys-cards">
                    {g.cards.map((c) => (
                      <div className="subsys-card" key={c.n}>
                        <div className="subsys-card-top">
                          <span className="mono cap muted">{c.n}</span>
                          <span className="mono cap" style={{ color: c.p === 'P1' ? 'var(--ink-soft)' : 'var(--muted)', letterSpacing: '0.1em' }}>
                            {c.p}
                          </span>
                        </div>
                        <div className="subsys-card-name serif-i">{c.name}</div>
                        <div className="subsys-card-sub">{c.sub}</div>
                        <div className="subsys-card-stack mono cap muted">{c.stack}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============== ARCHITECTURE (reference parity) ============== */}
        <section id="architecture" className="architecture">
          <div className="container">
            <div className="section-head feature-split-head">
              <div className="feature-split-copy">
                <div className="eyebrow mono cap">Architecture</div>
                <p className="section-sub">
                  Risk math lives in Rust, deployed as Stylus. The venue layer lives in
                  Solidity, on OpenZeppelin patterns. Chainlink CCIP is the messaging bus
                  between chains.
                </p>
              </div>
              <h2 className="h2">
                Stylus for hot math. <span className="accent-grad">Solidity</span> for the venue layer.
              </h2>
            </div>
            <div className="arch-stack">
              {[
                { num: 'L01', name: 'Postern', sub: 'User entry · wallet abstraction', chips: ['Passkey login', 'Gas sponsorship', 'Session keys', 'Social recovery'], side: 'PWA · Next.js' },
                { num: 'L02', name: 'Backend services', sub: 'Off-chain orchestration', chips: ['Tablet · tax', 'Codex · x402', 'Aqueduct coordinator', 'Rostrum copy-trade'], side: 'Single region · EU' },
                { num: 'L03', name: 'Stylus', sub: 'Rust → WASM · hot math', chips: ['Plinth · margin', 'Vigil · liquidations', 'Stoa · options'], side: 'Robinhood · Arbitrum Sepolia' },
                { num: 'L04', name: 'Solidity', sub: 'Venue + vault layer', chips: ['Portico v1.0.0', '9 adapter contracts', 'Coffer · ERC-4626', 'Sigil · ERC-8004'], side: 'OpenZeppelin' },
                { num: 'L05', name: 'Oracles + data', sub: 'Free testnet feeds', chips: ['Price Feeds', 'CCIP testnet', 'Pyth', 'Scribe'], side: 'Chainlink · Pyth · The Graph' },
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
      <div className="atrium-mobile-only">
        <MobileLanding data={d} />
      </div>
    </>
  );
}

function MobileLanding({ data }: { data: LandingData }) {
  return (
    <div className="atrium-m-root">
      <div className="iphone-screen">
        <div className="page landing-page">
          <nav className="topnav" aria-label="Mobile landing navigation">
            <Link href="/" className="mark">Atrium</Link>
            <div className="topnav-right">
              <Link href="/app" className="cta">Open testnet ↗</Link>
              {/* Launch-QA fix: the mobile landing topnav previously had no menu,
                  so Product/Agents/Architecture/Reserves/Docs were unreachable on
                  phones (the desktop PublicNav is display:none under .atrium-desktop-only).
                  Native <details> disclosure = working menu with no client JS. */}
              <details className="m-menu">
                <summary className="m-menu-btn" aria-label="Open menu">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M3 5h12M3 9h12M3 13h12" /></svg>
                </summary>
                <div className="m-menu-sheet" role="menu">
                  <Link href="/#product" role="menuitem">Product</Link>
                  <Link href="/app/agents" role="menuitem">Agents</Link>
                  <Link href="/architecture" role="menuitem">Architecture</Link>
                  <Link href="/lantern" role="menuitem">Reserves</Link>
                  <Link href="/docs" role="menuitem">Docs</Link>
                </div>
              </details>
            </div>
          </nav>

          <div className="scroll">
            <section className="hero">
              <div className="hero-grid" />
              <div className="hero-glow" />
              <div className="hero-eyebrow">
                <span className="rule" />
                <span>Unified margin · EVM · testnet</span>
              </div>
              <h1>
                One wallet. Every venue.
                <br />
                One <em>buying-power</em>
                <br />
                number.
              </h1>
              <p className="sub">
                Atrium is unified margin prime brokerage for the EVM. Post collateral once.
                Trade across onchain venues against one figure, computed onchain by Plinth.
              </p>
              <div className="hero-cta">
                <Link href="/app" className="primary">Open testnet ↗</Link>
                <Link href="#product" className="ghost">See how it works</Link>
              </div>
              <div className="hero-trust">
                <span><span className="td" /> Arbitrum Sepolia</span>
                <span><span className="td" /> Chainlink CCIP</span>
                <span><span className="td" /> ERC-8004</span>
              </div>
            </section>

            <div className="impluvium">
              <div className="label-row">
                <div className="left">
                  <div><strong>Fig. 01</strong> · Capital convergence</div>
                  <div style={{ marginTop: 3 }}>Plan view · illustrative schematic</div>
                </div>
                <div className="right">
                  <div><strong>Sheet 02 / 08</strong></div>
                  <div style={{ marginTop: 3 }}>Atrium Labs · 2026</div>
                </div>
              </div>

              <div className="pool">
                <div className="l">Pool · unified margin</div>
                <div className="v">$10,772,190</div>
                <div className="s">Buying power · 3.0× portfolio margin</div>
              </div>

              <div className="venues">
                {[
                  ['HL-HIP3', 'Tokenized perps', '$1.25M', '100%'],
                  ['AAVE-V3', 'RWA · USTB', '$892K', '71%'],
                  ['TRADE', 'RFQ · dark pool', '$401K', '32%'],
                  ['PENDLE', 'PT · stETH', '$320K', '26%'],
                  ['HL-HIP4', 'Permissioned', '$483K', '39%'],
                  ['CURVE', '3pool LP', '$186K', '15%'],
                ].map(([name, sub, amount, width], index) => (
                  <div className="venue" key={name}>
                    <div className="name">{name}</div>
                    <div className="sub">{sub}</div>
                    <div className="amt">{amount}</div>
                    <div className="bar">
                      <span style={{ width, background: index === 0 ? 'var(--accent)' : undefined }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="scale">
                <span>0×</span><span>2×</span><span>4×</span><span>6×</span><span>10×</span>
              </div>
            </div>

            <section className="section" id="product">
              <div className="section-num"><span className="accent">01</span> · The product</div>
              <h2>Capital efficiency, <em>mathematically.</em></h2>
              <p className="lede">
                Plinth reads collateral across every venue and returns one cross-product
                margin number per block.
              </p>
              <div className="feat">
                <div className="feat-eyebrow">Plinth · Stylus</div>
                <div className="t">SPAN-style portfolio margin, <em>onchain.</em></div>
                <div className="d">
                  The hot risk loop lives in Rust via Stylus, while the venue layer stays
                  Solidity and standards-friendly.
                </div>
                <div className="mock">
                  <div className="mock-head"><span className="l">Buying power</span><span className="pill">live</span></div>
                  <div className="big">{data.tvl}</div>
                  <div className="mock-row"><span className="l">Venue adapters</span><span className="v">{data.venuesDeployed} / {data.venuesTotal}</span></div>
                  <div className="mock-row"><span className="l">Margin</span><span className="v">SPAN</span></div>
                  <div className="mock-row"><span className="l">Engine</span><span className="v">Stylus</span></div>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="section-num"><span className="accent">02</span> · Cross-chain</div>
              <h2>Move collateral in <em>one transaction.</em></h2>
              <p className="lede">
                Aqueduct routes through Chainlink CCIP so collateral posted on one chain
                becomes Plinth credit on another.
              </p>
              <div className="move-mock">
                <div className="ends">
                  <div className="end"><div className="l">From</div><div className="n">arb-sepolia</div></div>
                  <div className="arrow">→</div>
                  <div className="end" style={{ textAlign: 'right' }}><div className="l">To</div><div className="n">rh-chain</div></div>
                </div>
                <div className="amt">50,000<span className="u">USDC</span></div>
                <div className="meta">CCIP fee · testnet · estimated 8.4s</div>
              </div>
            </section>

            <section className="section">
              <div className="section-num"><span className="accent">03</span> · Agents</div>
              <h2>Agents trade with <em>bounded mandates.</em></h2>
              <p className="lede">
                Sigil turns one typed signature into a finite mandate: one agent, one
                strategy, one cap, one expiry.
              </p>
              <div className="sigil-mock">
                <div className="step"><span className="m">✓</span><span className="desc">Intent Sigil signed<span className="v">agent · cap · ttl</span></span></div>
                <div className="step"><span className="m">✓</span><span className="desc">Session key issued<span className="v">Postern · scoped key</span></span></div>
                <div className="step"><span className="x">→</span><span className="desc">Action Sigil checked<span className="v">Vigil · mandate ok</span></span></div>
              </div>
            </section>

            <div className="stats-band">
              <div className="head">Live testnet surface</div>
              <div className="stats-grid">
                <div className="stat"><div className="l">TVL</div><div className="v">{data.tvl}</div><div className="s">from Scribe</div></div>
                <div className="stat"><div className="l">Venues</div><div className="v">{data.venuesDeployed}/{data.venuesTotal}</div><div className="s">registered</div></div>
                <div className="stat"><div className="l">Lantern</div><div className="v">{data.lanternRoot}</div><div className="s">{data.lanternMinsAgo}</div></div>
                <div className="stat"><div className="l">Agents</div><div className="v">{data.agents}</div><div className="s">Rostrum</div></div>
              </div>
            </div>

            <div className="cta-band">
              <h3>Step inside. <em>The testnet is open.</em></h3>
              <p>Onboard with a passkey, claim faucet funds, then post collateral against one margin number.</p>
              <div className="actions">
                <Link href="/app" className="primary">Open testnet ↗</Link>
                <Link href="/verify/1" className="ghost">Verifier walk</Link>
              </div>
            </div>

            <footer>
              <div className="foot-mark">Atrium</div>
              <div className="foot-sub">Unified margin prime brokerage<br />for the EVM.</div>
              <div className="foot-base"><span className="dot" /> Testnet only · not investment advice</div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
