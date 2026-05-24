'use client';

import { useQuery } from '@tanstack/react-query';
import { SectionShell } from './section-shell';

/**
 * Subsystems section. Audit P-5 fix: prior copy said "Thirteen are live on
 * testnet today" — unsourced. Now we render the live count from
 * /api/protocol/metrics (which itself reads from
 * deployments/arbitrum_sepolia.json) and label each piece with a green dot
 * when its address is in the registry, a muted dot when not.
 *
 * BLOCKS lists the 18 named subsystems matching ATRIUM_PRD §11 / TDD §7.
 * Each piece has a `slug` matching the deployments registry key.
 */
interface SubsystemPiece { name: string; slug: string; }
interface Block { title: string; pieces: SubsystemPiece[]; }

const BLOCKS: Block[] = [
  {
    title: 'Risk engine',
    pieces: [
      { name: 'Plinth', slug: 'plinth' },
      { name: 'Vigil', slug: 'vigil' },
      { name: 'Coffer', slug: 'coffer' },
      { name: 'PorticoRegistry', slug: 'portico-registry' },
    ],
  },
  {
    title: 'Venues + cross-chain',
    pieces: [
      { name: 'Aqueduct', slug: 'aqueduct' },
      { name: 'Hyperliquid', slug: 'adapter-hyperliquid' },
      { name: 'Aave Horizon', slug: 'adapter-aave-horizon' },
      { name: 'Pendle V2', slug: 'adapter-pendle' },
      { name: 'Curve', slug: 'adapter-curve' },
      { name: 'Trade.xyz', slug: 'adapter-trade-xyz' },
      { name: 'Polymarket', slug: 'adapter-polymarket' },
    ],
  },
  {
    title: 'Agents + APIs',
    pieces: [
      { name: 'Sigil', slug: 'sigil' },
      { name: 'Postern', slug: 'postern-kill-switch' },
      { name: 'Codex', slug: 'codex' },
      { name: 'ResearchAttestation', slug: 'research-attestation' },
      { name: 'Rostrum', slug: 'rostrum' },
    ],
  },
  {
    title: 'Trust + ops',
    pieces: [
      { name: 'PraetorTimelock', slug: 'praetor-timelock' },
      { name: 'Lantern', slug: 'lantern-attestor' },
      { name: 'Edict', slug: 'edict' },
      { name: 'Tablet', slug: 'tablet' },
      { name: 'Stoa (Phase-2)', slug: 'stoa' },
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
          ? `Each subsystem owns one responsibility. ${total} ship at launch — none deployed yet (testnet Wave-1 lands Month 1 W2).`
          : `Each subsystem owns one responsibility. ${liveCount} of ${total} are live on testnet today; all ${total} ship at launch — with Stoa conditional on Phase-2 funding.`
      }
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {BLOCKS.map((b) => (
          <div key={b.title} className="rounded-lg border border-divider bg-parchment p-5">
            <h3 className="font-display text-xl italic text-ink">{b.title}</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
              {b.pieces.map((p) => {
                const isLive = liveSet.has(p.slug);
                return (
                  <li key={p.slug} className="flex items-baseline gap-2">
                    <span
                      className={'size-1.5 shrink-0 rounded-full ' + (isLive ? 'bg-success' : 'bg-divider')}
                      aria-label={isLive ? 'live' : 'pending'}
                    />
                    <span className="font-mono text-xs">{p.name}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
