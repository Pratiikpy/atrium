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
    // col-span-full: AppShell's `.atrium-app` is a 2-col grid (sidebar | main).
    // Without this the banner auto-places into the narrow sidebar cell and shoves
    // the whole layout out of place when on the wrong network. Span both columns
    // so it is a full-width bar on its own row above the sidebar + main.
    <div className="col-span-full row-start-1 flex items-center justify-between gap-3 bg-testnet/10 border-b border-testnet/30 px-4 py-2.5 text-sm">
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
