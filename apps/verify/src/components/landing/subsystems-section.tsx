'use client';

import { useQuery } from '@tanstack/react-query';
import { SectionShell } from './section-shell';

/**
 * Subsystems section. Canon at design/extracted/Atriumnew/index.html:1245-1322:
 * vertical stack of architectural blocks; each block has a sticky 280px
 * head on the left (title + sub) and an auto-fill 190px card grid on the
 * right; each card is one named subsystem with a live/pending dot.
 *
 * Live-status pattern: /api/protocol/subsystems returns the list of
 * slugs whose contract address is present in the deployments registry.
 * Per writing.md, sub-counts come from real data, not aspiration.
 */
interface SubsystemPiece { name: string; slug: string; role: string; }
interface Block { title: string; intro: string; pieces: SubsystemPiece[]; }

const BLOCKS: Block[] = [
  {
    title: 'Risk engine',
    intro: 'Margin, liquidation, and the vault that holds every venue receipt.',
    pieces: [
      { name: 'Plinth',           slug: 'plinth',            role: 'Margin engine' },
      { name: 'Vigil',            slug: 'vigil',             role: 'Liquidations' },
      { name: 'Coffer',           slug: 'coffer',            role: 'ERC-4626 vault' },
      { name: 'PorticoRegistry',  slug: 'portico-registry',  role: 'Adapter whitelist' },
    ],
  },
  {
    title: 'Venues + cross-chain',
    intro: 'Adapters whitelisted by the curator multisig; cross-chain via Chainlink CCIP.',
    pieces: [
      { name: 'Aqueduct',     slug: 'aqueduct',             role: 'CCIP router' },
      { name: 'Hyperliquid',  slug: 'adapter-hyperliquid',  role: 'HIP-3 + HIP-4 perps' },
      { name: 'Aave Horizon', slug: 'adapter-aave-horizon', role: 'RWA . USTB' },
      { name: 'Pendle V2',    slug: 'adapter-pendle',       role: 'PT . stETH' },
      { name: 'Curve',        slug: 'adapter-curve',        role: '3pool LP' },
      { name: 'Trade.xyz',    slug: 'adapter-trade-xyz',    role: 'Equity RFQ' },
      { name: 'Polymarket',   slug: 'adapter-polymarket',   role: 'Prediction markets' },
    ],
  },
  {
    title: 'Agents + APIs',
    intro: 'Agent delegation primitives and the read-side x402 API.',
    pieces: [
      { name: 'Sigil',                slug: 'sigil',                role: 'ERC-8004 mandates' },
      { name: 'Postern',              slug: 'postern-kill-switch',  role: 'Smart wallet + kill switch' },
      { name: 'Codex',                slug: 'codex',                role: 'x402 . onchain queries' },
      { name: 'ResearchAttestation',  slug: 'research-attestation', role: 'Onchain backtests' },
      { name: 'Rostrum',              slug: 'rostrum',              role: 'Agent leaderboard' },
    ],
  },
  {
    title: 'Trust + ops',
    intro: 'Multisig + timelock + proof-of-reserves + ops tooling.',
    pieces: [
      { name: 'PraetorTimelock',  slug: 'praetor-timelock',  role: '48h timelock + multisig' },
      { name: 'Lantern',          slug: 'lantern-attestor',  role: 'Proof of reserves' },
      { name: 'Edict',            slug: 'edict',             role: 'Governance log' },
      { name: 'Tablet',           slug: 'tablet',            role: 'Ops dashboard' },
      { name: 'Stoa (Phase-2)',   slug: 'stoa',              role: 'Public verifier path' },
    ],
  },
];

interface LiveStatus { live: string[]; source: 'deployments' | 'pending'; }

async function fetchLive(): Promise<LiveStatus> {
  try {
    const r = await fetch('/api/protocol/subsystems');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { live: [], source: 'pending' };
  }
}

export function SubsystemsSection() {
  const { data } = useQuery({ queryKey: ['subsystems-live'], queryFn: fetchLive, refetchInterval: 60_000 });
  const liveSet = new Set(data?.live ?? []);
  const total = BLOCKS.reduce((s, b) => s + b.pieces.length, 0);
  const liveCount = BLOCKS.reduce((s, b) => s + b.pieces.filter((p) => liveSet.has(p.slug)).length, 0);

  return (
    <SectionShell
      id="system"
      eyebrow="Subsystems"
      headline={`${total} named pieces. Four architectural blocks.`}
      sub={
        liveCount === 0
          ? `Each subsystem owns one responsibility. ${total} ship at launch; none deployed yet (testnet Wave-1 lands Month 1 W2).`
          : `Each subsystem owns one responsibility. ${liveCount} of ${total} are live on testnet today; all ${total} ship at launch, with Stoa conditional on Phase-2 funding.`
      }
    >
      <div className="mt-12 flex flex-col border-t border-ink">
        {BLOCKS.map((b, i) => (
          <div
            key={b.title}
            className={`grid items-start gap-8 py-10 md:grid-cols-[280px_minmax(0,1fr)] md:gap-14 md:py-12 ${
              i === BLOCKS.length - 1 ? 'border-b border-ink' : 'border-b border-divider'
            }`}
          >
            <div className="md:sticky md:top-24">
              <h3 className="font-display text-[28px] italic tracking-[-0.018em] text-ink">
                {b.title}
              </h3>
              <p className="mt-2 max-w-[260px] text-[14.5px] leading-[1.55] text-ink-soft">
                {b.intro}
              </p>
              <p className="mt-3 font-mono text-[10.5px] uppercase tracking-wider text-muted">
                {b.pieces.filter((p) => liveSet.has(p.slug)).length} of {b.pieces.length} live
              </p>
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
              {b.pieces.map((p) => {
                const isLive = liveSet.has(p.slug);
                return (
                  <article
                    key={p.slug}
                    className="group flex min-h-[170px] flex-col rounded-xl border border-divider bg-parchment-light px-5 py-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-ink hover:shadow-md"
                  >
                    <header className="mb-3 flex items-baseline justify-between">
                      <h4 className="text-[26px] leading-none tracking-[-0.012em] text-ink">
                        {p.name}
                      </h4>
                      <span
                        className={`size-1.5 rounded-full ${isLive ? 'bg-live' : 'bg-divider'}`}
                        aria-label={isLive ? 'live' : 'pending'}
                      />
                    </header>
                    <p className="flex-1 text-[13px] leading-[1.45] text-ink-soft">
                      {p.role}
                    </p>
                    <div className="mt-3.5 border-t border-divider pt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
                      {isLive ? 'live . arb-sepolia' : 'pending . wave-1'}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
