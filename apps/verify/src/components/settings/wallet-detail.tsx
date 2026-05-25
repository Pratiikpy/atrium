'use client';

import { useQuery } from '@tanstack/react-query';

interface Wallet {
  address: string;
  ens: string | null;
  authenticator: string;
  bundler: string;
  paymaster: string;
  erc4337Ready: boolean;
  erc7702Ready: boolean;
  source: 'postern' | 'pending';
}

async function fetchWallet(): Promise<Wallet> {
  try {
    const r = await fetch('/api/settings/wallet');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return {
      address: '—',
      ens: null,
      authenticator: '—',
      bundler: '—',
      paymaster: '—',
      erc4337Ready: false,
      erc7702Ready: false,
      source: 'pending',
    };
  }
}

export function WalletDetailCard() {
  const { data } = useQuery({ queryKey: ['settings-wallet'], queryFn: fetchWallet, refetchInterval: 60_000 });
  const ready = data?.erc4337Ready && data?.erc7702Ready;
  return (
    <section className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-xl italic text-ink">Smart wallet</p>
        <span className={
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ' +
          (ready ? 'border-live/30 bg-live-soft text-live' : 'border-divider bg-parchment-soft/60 text-muted')
        }>
          <span className={'size-1.5 rounded-full ' + (ready ? 'bg-live' : 'bg-muted')} />
          {ready ? 'ERC-4337 · 7702 ready' : 'Postern pending'}
        </span>
      </header>

      <dl className="mt-5 divide-y divide-divider-soft">
        <RowLine label="Address" value={data?.address ?? '—'} mono />
        <RowLine label="ENS" value={data?.ens ?? '—'} mono />
        <RowLine label="Authenticator" value={data?.authenticator ?? '—'} />
        <RowLine label="Bundler" value={data?.bundler ?? '—'} />
        <RowLine label="Paymaster" value={data?.paymaster ?? '—'} />
      </dl>
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
