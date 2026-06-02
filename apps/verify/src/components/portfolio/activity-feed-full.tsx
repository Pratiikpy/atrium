'use client';

import { useQuery } from '@tanstack/react-query';
import { arbiscanTxUrl } from '@/lib/arbiscan';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

interface Activity {
  id: string;
  kind: 'tx' | 'attestation' | 'mandate' | 'liquidation';
  title: string;
  meta: string;
  timestamp: string;
  txHash?: string;
}
interface Resp { activities: Activity[]; source: 'scribe' | 'pending'; }

async function fetchActivity(wallet: string | null): Promise<Resp> {
  const r = await fetch(walletQuery('/api/portfolio/activity?limit=200', wallet));
  if (!r.ok) throw new Error(`activity_${r.status}`);
  return r.json();
}

export function ActivityFeedFull() {
  const wallet = useScopedWallet();
  const { data, isLoading, error } = useQuery({
    queryKey: ['activity-full', wallet],
    queryFn: () => fetchActivity(wallet),
    refetchInterval: 30_000,
    enabled: wallet != null, // no wallet -> guided empty state, never a 401
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-neg/40 bg-neg/5 p-6 text-sm">
        <p className="font-medium text-neg">Could not load activity</p>
        <p className="mt-1 text-ink-soft">Scribe is unreachable.</p>
      </div>
    );
  }

  if (!data?.activities.length) {
    return (
      <div className="rounded-md border border-divider bg-parchment-soft/40 p-12 text-center">
        <p className="text-sm text-ink-soft">No activity indexed yet.</p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
          {data?.source === 'pending' ? 'scribe pending · contracts deploy month 1 w2' : 'open a position to record one'}
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {data.activities.map((a) => (
        <li key={a.id} className="rounded-md border border-divider bg-parchment p-4 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <KindPill kind={a.kind} />
              <p className="font-medium text-ink">{a.title}</p>
            </div>
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">
              {a.timestamp}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">{a.meta}</p>
          {(() => {
            const url = arbiscanTxUrl(a.txHash);
            return url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block font-mono text-[10px] text-muted hover:text-ink"
              >
                {a.txHash!.slice(0, 10)}…{a.txHash!.slice(-6)} ↗
              </a>
            ) : null;
          })()}
        </li>
      ))}
    </ol>
  );
}

function KindPill({ kind }: { kind: Activity['kind'] }) {
  const styles: Record<Activity['kind'], string> = {
    tx: 'border-divider text-muted',
    attestation: 'border-live/30 text-live',
    mandate: 'border-testnet/30 text-testnet',
    liquidation: 'border-neg/30 text-neg',
  };
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${styles[kind]}`}>
      {kind}
    </span>
  );
}
