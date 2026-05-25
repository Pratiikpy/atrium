'use client';

import { useQuery } from '@tanstack/react-query';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';
import { arbiscanTxUrl } from '@/lib/arbiscan';

interface Step {
  label: string;
  status: 'complete' | 'in_progress' | 'pending';
  // Audit U-22: per-step delta is null when we can't measure it. Pre-fix
  // the success path returned literal strings "0.0s" / "1.2s" / "3.4s" /
  // "8.4s" that looked like measured CCIP step timings.
  delta: string | null;
}
interface LastTransfer {
  from: string;
  to: string;
  amount: string;
  asset: string;
  status: 'SETTLED' | 'IN_TRANSIT' | 'CLAIMED_BACK' | null;
  steps: Step[];
  /** Real measurement: blocks between source-commit and dest-settle, when settled. */
  blocksElapsed: number | null;
  txHash: string | null;
  source: 'scribe' | 'pending';
}

async function fetchLast(wallet: string | null): Promise<LastTransfer> {
  try {
    const r = await fetch(walletQuery('/api/transfer/last', wallet));
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return {
      from: 'ARB',
      to: 'RHC',
      amount: '0',
      asset: 'USDC',
      status: null,
      steps: [
        { label: 'Signature submitted', status: 'pending', delta: null },
        { label: 'Source commit · Aqueduct', status: 'pending', delta: null },
        { label: 'CCIP message in transit', status: 'pending', delta: null },
        { label: 'Destination finalised', status: 'pending', delta: null },
      ],
      blocksElapsed: null,
      txHash: null,
      source: 'pending',
    };
  }
}

export function TransferTimeline() {
  const wallet = useScopedWallet();
  const { data } = useQuery({
    queryKey: ['last-transfer', wallet],
    queryFn: () => fetchLast(wallet),
    refetchInterval: 5_000,
  });
  return (
    <section className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-xl italic text-ink">Last transfer</p>
        <span className="rounded-full border border-divider px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-muted">
          {data?.status ?? 'pending'}
        </span>
      </header>

      <div className="mt-4 rounded-md bg-parchment-soft/60 px-4 py-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
          <span>From</span>
          <span>To</span>
        </div>
        <div className="mt-1 flex items-center justify-between font-mono">
          <span className="text-ink">{data?.from ?? 'ARB'}</span>
          <span className="text-muted">────────────────</span>
          <span className="text-ink">{data?.to ?? 'RHC'}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
          <span>Arbitrum Sepolia</span>
          <span>Robinhood Chain</span>
        </div>
      </div>

      <p className="mt-4 font-mono text-3xl text-ink">
        {data?.amount ?? '0'} <span className="text-muted">{data?.asset ?? 'USDC'}</span>
      </p>

      <ol className="mt-5 space-y-3">
        {(data?.steps ?? []).map((s, i) => (
          <li key={i} className="flex items-center gap-3">
            <Bullet status={s.status} />
            <div className="flex-1">
              <p className="text-sm text-ink">{s.label}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted">
                {s.status === 'complete' ? 'complete' : s.status === 'in_progress' ? 'in progress' : 'pending'}
              </p>
            </div>
            <span className="font-mono text-[11px] text-muted">{s.delta ?? '—'}</span>
          </li>
        ))}
      </ol>

      {/* Audit U-22: the only honest measurement we have is blocks-elapsed
          between source-commit and dest-settle. Surface it when present;
          omit when null rather than render "—" next to a "settled" badge. */}
      {data?.blocksElapsed != null && (
        <p className="mt-4 text-[10px] uppercase tracking-wider text-muted">
          {data.blocksElapsed} blocks between source commit and dest settle
        </p>
      )}

      {(() => {
        // Audit SS-1 fix: validated Arbiscan URL via shared helper.
        const url = arbiscanTxUrl(data?.txHash);
        return url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block font-mono text-[10px] text-muted hover:text-ink"
          >
            {data!.txHash!.slice(0, 10)}…{data!.txHash!.slice(-6)} ↗
          </a>
        ) : null;
      })()}
    </section>
  );
}

function Bullet({ status }: { status: Step['status'] }) {
  const c =
    status === 'complete'
      ? 'bg-ink text-parchment border-ink'
      : status === 'in_progress'
      ? 'bg-parchment text-ink border-ink animate-pulse'
      : 'bg-parchment text-muted border-divider';
  return (
    <span className={'flex size-5 shrink-0 items-center justify-center rounded-full border ' + c}>
      <span className="size-1.5 rounded-full bg-current" />
    </span>
  );
}
