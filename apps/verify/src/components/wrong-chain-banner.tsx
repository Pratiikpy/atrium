'use client';

import { useChainGuard } from '@/lib/use-chain-guard';

/**
 * Banner shown when the connected wallet is on the wrong chain.
 * Renders above the sidebar/topbar in AppShell.
 */
export function WrongChainBanner() {
  const { ok, current, switchChain } = useChainGuard();

  if (ok) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-testnet/10 border-b border-testnet/30 px-4 py-2.5 text-sm">
      <p className="text-testnet font-medium">
        Wrong network{current ? ` (${current.name})` : ''}. Atrium runs on Arbitrum Sepolia.
      </p>
      <button
        type="button"
        onClick={switchChain}
        className="shrink-0 rounded-md bg-testnet px-3 py-1.5 text-xs font-medium text-parchment hover:bg-testnet/90"
      >
        Switch to Arbitrum Sepolia
      </button>
    </div>
  );
}
