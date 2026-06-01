'use client';

import { useQuery } from '@tanstack/react-query';

interface MerkleStructure {
  leafCount: number | null;
  depth: number | null;
  sampleNodes: Array<{ depth: number; hash: string }>;
  source: 'scribe' | 'pending';
}

async function fetchMS(): Promise<MerkleStructure> {
  try {
    const r = await fetch('/api/reserves/merkle');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { leafCount: null, depth: null, sampleNodes: [], source: 'pending' };
  }
}

export function MerkleStructureCard() {
  const { data } = useQuery({ queryKey: ['merkle-structure'], queryFn: fetchMS, refetchInterval: 60_000 });
  return (
    <section className="rounded-md border border-divider bg-parchment p-5">
      <header>
        <p className="font-display text-xl italic text-ink">Merkle structure</p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">
          {data?.leafCount != null
            ? `${data.leafCount.toLocaleString('en-US')} leaves · depth ${data.depth ?? '-'}`
            : 'tree depth: pending'}
        </p>
      </header>

      <svg viewBox="0 0 240 160" className="mt-4 w-full">
        <rect x="105" y="10" width="30" height="20" rx="4" fill="var(--color-ink)" />
        <text x="120" y="24" textAnchor="middle" fontSize="9" fontFamily="Geist Mono" fill="var(--color-parchment)">root</text>
        <line x1="120" y1="30" x2="60" y2="50" stroke="currentColor" strokeWidth="0.5" className="text-muted" />
        <line x1="120" y1="30" x2="180" y2="50" stroke="currentColor" strokeWidth="0.5" className="text-muted" />
        <rect x="45" y="50" width="30" height="20" rx="4" fill="var(--color-parchment-soft)" stroke="var(--color-divider)" />
        <rect x="165" y="50" width="30" height="20" rx="4" fill="var(--color-parchment-soft)" stroke="var(--color-divider)" />
        <line x1="60" y1="70" x2="30" y2="100" stroke="currentColor" strokeWidth="0.4" className="text-muted" />
        <line x1="60" y1="70" x2="90" y2="100" stroke="currentColor" strokeWidth="0.4" className="text-muted" />
        <line x1="180" y1="70" x2="150" y2="100" stroke="currentColor" strokeWidth="0.4" className="text-muted" />
        <line x1="180" y1="70" x2="210" y2="100" stroke="currentColor" strokeWidth="0.4" className="text-muted" />
        {[15, 75, 135, 195].map((x, i) => {
          // 065-FE10 fix: never synthesize hash-shaped labels from the map
          // index. Render the real attested leaf hash when the API surfaces
          // one in sampleNodes; otherwise show a neutral, clearly-illustrative
          // 'leaf' marker. The boxes are a schematic of tree shape, not a
          // claim about specific attested leaves.
          const node = data?.sampleNodes?.[i];
          return (
            <g key={i}>
              <rect x={x} y="100" width="30" height="20" rx="4" fill="var(--color-parchment)" stroke="var(--color-divider)" />
              <text x={x + 15} y="114" textAnchor="middle" fontSize="8" fontFamily="Geist Mono" className="fill-ink-soft">
                {node ? `${node.hash.slice(0, 6)}…` : 'leaf'}
              </text>
            </g>
          );
        })}
        <text x="120" y="148" textAnchor="middle" fontSize="9" fontFamily="Geist Mono" className="fill-muted">
          ⋯ {data?.leafCount ? `${data.leafCount.toLocaleString('en-US')} leaves` : 'pending'} ⋯
        </text>
      </svg>

      <p className="mt-3 text-[11px] text-muted">
        Schematic of the attested tree, the boxes show its shape, not specific leaves (real
        leaves are per-account balance hashes). Leaf count and depth above are read live from the
        latest on-chain Lantern attestation. Use Verify my balance to check your own inclusion.
      </p>
    </section>
  );
}
