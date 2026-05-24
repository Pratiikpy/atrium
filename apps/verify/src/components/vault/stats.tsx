'use client';

import { useQuery } from '@tanstack/react-query';

interface VaultStatsResponse {
  vaultTvlUsd: string | null;
  userSharesFormatted: string | null;
  sharePriceUsd: string | null;
  source: 'coffer' | 'pending';
}

async function fetchStats(): Promise<VaultStatsResponse> {
  try {
    const r = await fetch('/api/vault/stats');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { vaultTvlUsd: null, userSharesFormatted: null, sharePriceUsd: null, source: 'pending' };
  }
}

export function VaultStats() {
  const { data } = useQuery({ queryKey: ['vault-stats'], queryFn: fetchStats, refetchInterval: 30_000 });
  const sourceCaption = data?.source === 'coffer' ? 'from Coffer · live RPC' : 'coffer pending · deploy Month 1 W2';
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Tile label="Vault TVL" value={data?.vaultTvlUsd ?? '—'} sub="from Coffer.totalAssets()" source={sourceCaption} />
      <Tile label="Your shares" value={data?.userSharesFormatted ?? '—'} sub="from Coffer.balanceOf(you)" source={sourceCaption} />
      <Tile label="Share price" value={data?.sharePriceUsd ?? '—'} sub="assets / shares (4626)" source={sourceCaption} />
    </div>
  );
}

function Tile({ label, value, sub, source }: { label: string; value: string; sub: string; source: string }) {
  return (
    <div className="rounded-md border border-divider bg-parchment p-5">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-3 font-mono text-2xl text-ink">{value}</p>
      <p className="mt-1 text-[10px] text-muted">{sub}</p>
      <p className="mt-2 text-[9px] uppercase tracking-wider text-muted">{source}</p>
    </div>
  );
}
