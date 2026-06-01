'use client';

import { useQuery } from '@tanstack/react-query';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';
import { ConnectWallet } from '@/components/connect-wallet';

interface Wallet {
  address: string;
  ens: string | null;
  authenticator: string | null;
  bundler: string | null;
  paymaster: string | null;
  erc4337Ready: boolean;
  erc7702Ready: boolean;
  sessionKeyRegistry?: string | null;
  source: 'postern' | 'pending';
}

async function fetchWallet(wallet: string | null): Promise<Wallet> {
  try {
    const r = await fetch(walletQuery('/api/settings/wallet', wallet));
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return {
      address: '-',
      ens: null,
      authenticator: null,
      bundler: null,
      paymaster: null,
      erc4337Ready: false,
      erc7702Ready: false,
      sessionKeyRegistry: null,
      source: 'pending',
    };
  }
}

export function WalletDetailCard() {
  const scopedWallet = useScopedWallet();
  const { data } = useQuery({
    queryKey: ['settings-wallet', scopedWallet],
    queryFn: () => fetchWallet(scopedWallet),
    refetchInterval: 60_000,
  });
  // 063-FE8 fix: the green signal reflects the REAL on-chain session-key
  // registry being live, not a fabricated "ERC-4337 · 7702 ready" claim
  // (no bundler/paymaster/AA exists yet).
  const sessionKeysLive = data?.source === 'postern';
  return (
    <section className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-xl italic text-ink">Smart wallet</p>
        <span className={
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ' +
          (sessionKeysLive ? 'border-live/30 bg-live-soft text-live' : 'border-divider bg-parchment-soft/60 text-muted')
        }>
          <span className={'size-1.5 rounded-full ' + (sessionKeysLive ? 'bg-live' : 'bg-muted')} />
          {sessionKeysLive ? 'Session keys live' : 'Pending'}
        </span>
      </header>

      {/* Real connect/disconnect entry (blocker fix): the app had no working
          wallet-connect anywhere in /app/* - this is the canonical one. */}
      <div className="mt-4">
        <ConnectWallet variant="button" />
      </div>

      <dl className="mt-5 divide-y divide-divider-soft">
        <RowLine label="Address" value={data?.address ?? '-'} mono />
        <RowLine label="ENS" value={data?.ens ?? '-'} mono />
        <RowLine label="Authenticator" value={data?.authenticator ?? '-'} />
        <RowLine label="Session keys" value={sessionKeysLive ? 'Postern registry · live' : 'pending'} />
        <RowLine label="Bundler" value={data?.bundler ?? 'none'} />
        <RowLine label="Paymaster" value={data?.paymaster ?? 'none'} />
      </dl>

      <p className="mt-3 text-[11px] text-muted">
        Gas is self-funded on testnet, there is no bundler or paymaster yet.
        ERC-4337 / ERC-7702 account abstraction is a Year-2 item; Postern
        currently provides the on-chain session-key registry.
      </p>
    </section>
  );
}

function RowLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-3 text-sm">
      <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className={mono ? 'font-mono text-ink' : 'text-ink'}>{value}</dd>
    </div>
  );
}
