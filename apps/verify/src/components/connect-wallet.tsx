'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { getAddress } from 'viem';

/**
 * The real wallet-connect control for the authenticated app.
 *
 * Audit FIX (blocker, frontend-pages #3): before this, /app/* had no working
 * connect entry point at all - the sidebar card only linked to /app/settings,
 * and settings had no connect button, so a disconnected user could never
 * connect inside the app (every wallet-scoped surface stayed empty). The only
 * working connect lived in the /verify demo flow. This wires useConnect against
 * the configured coinbaseWallet (smart-wallet) connector so the app is usable.
 *
 * variant: 'button' (settings, full-width) or 'inline' (compact, sidebar).
 */
export function ConnectWallet({
  variant = 'button',
  className = '',
}: {
  variant?: 'button' | 'inline';
  className?: string;
}) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const connector = connectors[0];
  const pending = status === 'pending';

  if (isConnected && address) {
    const a = getAddress(address);
    const short = `${a.slice(0, 6)}…${a.slice(-4)}`;
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink">
          <span className="size-1.5 rounded-full bg-live" aria-hidden />
          {short}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-md border border-divider px-2.5 py-1 text-[11px] text-muted hover:border-ink/30 hover:text-ink"
        >
          Disconnect
        </button>
      </div>
    );
  }

  const handle = () => {
    if (connector) connect({ connector });
  };

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={!connector || pending}
        aria-label="Connect wallet"
        className={`inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-parchment hover:bg-ink/90 disabled:opacity-50 ${className}`}
      >
        {pending ? 'Connecting…' : 'Connect wallet'}
      </button>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handle}
        disabled={!connector || pending}
        className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-parchment hover:bg-ink/90 disabled:opacity-50"
      >
        {pending ? 'Connecting…' : 'Connect wallet'}
      </button>
      {!connector && (
        <p className="mt-2 text-[12px] text-muted">No wallet connector configured.</p>
      )}
      {error && <p className="mt-2 text-[12px] text-neg">{error.message}</p>}
      <p className="mt-2 text-[11px] text-muted">
        Atrium uses a passkey-bound smart wallet (Coinbase Smart Wallet). No seed phrase, no
        extension required.
      </p>
    </div>
  );
}
