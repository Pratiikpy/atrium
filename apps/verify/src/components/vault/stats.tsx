'use client';

import { useQuery } from '@tanstack/react-query';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

interface VaultStatsResponse {
  vaultTvlUsd: string | null;
  userSharesFormatted: string | null;
  userValueUsd: string | null;
  sharePriceUsd: string | null;
  source: 'coffer' | 'pending';
}

async function fetchStats(wallet: string | null): Promise<VaultStatsResponse> {
  try {
    const r = await fetch(walletQuery('/api/vault/stats', wallet));
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { vaultTvlUsd: null, userSharesFormatted: null, userValueUsd: null, sharePriceUsd: null, source: 'pending' };
  }
}

export function VaultStats() {
  const wallet = useScopedWallet();
  const { data } = useQuery({
    queryKey: ['vault-stats', wallet],
    queryFn: () => fetchStats(wallet),
    refetchInterval: 30_000,
  });
  const sourceCaption = data?.source === 'coffer' ? 'from Coffer · live RPC' : 'coffer pending · deploy Month 1 W2';
  // Only show wallet-scoped values when a wallet is actually connected. When
  // disconnected, useScopedWallet() returns null and /api/vault/stats falls back
  // to DEMO_WALLET_ADDRESS (kept so smoke tests + the explicit demo path still
  // work), but we must NOT label that demo balance as "your" value/shares
  // (CLAUDE.md red line: no mock data shown as real). Vault TVL is global/public
  // so it always shows; the per-user tiles show "-" until a wallet connects.
  const connected = wallet != null;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Tile label="Vault TVL" value={data?.vaultTvlUsd ?? '-'} sub="from Coffer.totalAssets()" source={sourceCaption} />
      <Tile label="Your value" value={connected ? (data?.userValueUsd ?? '-') : '-'} sub="redeemable · convertToAssets(your shares)" source={connected ? sourceCaption : 'connect a wallet'} />
      <Tile label="Your shares" value={connected ? (data?.userSharesFormatted ?? '-') : '-'} sub="ERC-4626 · 1e12 virtual-offset scale" source={connected ? sourceCaption : 'connect a wallet'} />
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
