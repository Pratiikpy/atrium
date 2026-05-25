'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';

/**
 * Sidebar wallet card - bottom of the AppShell.
 *
 * Audit 2026-05-24 H-2 fix: the previous server-component render hardcoded
 * `0x1a3b…7f29` regardless of which wallet (if any) was connected. The
 * card is split out as a `'use client'` component so it can read the live
 * wagmi account and degrade to an explicit "Not connected" state instead
 * of fake-looking address theatre.
 *
 * Click target routes to /app/settings - that page has the full connect/
 * disconnect surface. Keeping the click target lets users get to the
 * wallet picker even when they're not yet connected.
 */
export function AppShellWalletCard() {
  const { address, isConnected, chain } = useAccount();
  const display = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : 'Not connected';
  const chainLabel = chain?.name
    ? chain.name.toLowerCase().replace(/\s+/g, '-')
    : 'arb-sepolia';
  return (
    <Link
      href="/app/settings"
      aria-label={isConnected ? `Wallet ${display}` : 'Connect wallet'}
      className="mx-3 mb-4 mt-2 flex items-center gap-2 rounded-md border border-divider bg-parchment-light p-2 transition-colors hover:border-ink/30"
    >
      <span
        className={`size-7 shrink-0 rounded-full ${
          isConnected
            ? 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-ink-soft)]'
            : 'bg-divider'
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate font-mono text-xs ${isConnected ? 'text-ink' : 'text-muted'}`}>
          {display}
        </p>
        <p className="text-[10px] text-muted">{isConnected ? chainLabel : 'click to connect'}</p>
      </div>
      <span className="text-muted">›</span>
    </Link>
  );
}
