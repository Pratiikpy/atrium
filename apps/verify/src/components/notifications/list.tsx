'use client';

import { useQuery } from '@tanstack/react-query';
import { arbiscanTxUrl } from '@/lib/arbiscan';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

interface Notification {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  title: string;
  meta: string;
  timestamp: string;
  txHash?: string;
}
interface Resp { notifications: Notification[]; source: 'scribe' | 'pending'; }

async function fetchN(wallet: string | null): Promise<Resp> {
  try {
    const r = await fetch(walletQuery('/api/notifications', wallet));
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { notifications: [], source: 'pending' };
  }
}

export function NotificationsList() {
  const wallet = useScopedWallet();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', wallet],
    queryFn: () => fetchN(wallet),
    refetchInterval: 30_000,
    enabled: wallet != null, // disconnected -> no authed fetch (no 401)
  });
  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-md" />)}</div>;
  }
  if (!data?.notifications.length) {
    return (
      <div className="rounded-md border border-divider bg-parchment-soft/40 p-12 text-center">
        <p className="text-sm text-ink-soft">Inbox is empty.</p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
          {data?.source === 'pending'
            ? 'notifications populate from scribe once contracts deploy'
            : 'this is the calm one. nothing to flag.'}
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {data.notifications.map((n) => (
        <li key={n.id} className={'rounded-md border bg-parchment p-4 text-sm ' + severityClass(n.severity)}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-medium text-ink">{n.title}</p>
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">{n.timestamp}</span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">{n.meta}</p>
          {/* Audit SS-1 fix: validated Arbiscan URL via shared helper. */}
          {(() => {
            const url = arbiscanTxUrl(n.txHash);
            return url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block font-mono text-[10px] text-muted hover:text-ink"
              >
                {n.txHash!.slice(0, 10)}…{n.txHash!.slice(-6)} ↗
              </a>
            ) : null;
          })()}
        </li>
      ))}
    </ul>
  );
}

function severityClass(s: Notification['severity']): string {
  if (s === 'warning') return 'border-testnet/30';
  if (s === 'danger') return 'border-neg/40';
  return 'border-divider';
}
