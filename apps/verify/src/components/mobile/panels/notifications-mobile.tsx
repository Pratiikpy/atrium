'use client';

/**
 * NotificationsMobile, Mobile notification inbox.
 * Error state is distinct from empty state (E2E-15, E2E-49 fix).
 * 44px touch targets, 80px items, severity color stripe.
 */

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
  read?: boolean;
}
interface Resp { notifications: Notification[]; source: 'scribe' | 'pending'; }

export function NotificationsMobile() {
  const wallet = useScopedWallet();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications-mobile', wallet],
    queryFn: async (): Promise<Resp> => {
      const r = await fetch(walletQuery('/api/notifications', wallet));
      if (!r.ok) throw new Error(`notifications_${r.status}`);
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const unreadCount = (data?.notifications ?? []).filter(n => !n.read).length;

  async function markAllRead() {
    await fetch(walletQuery('/api/notifications/mark-read', wallet), { method: 'POST' });
    refetch();
  }

  // Error state (distinct from empty, E2E-15, E2E-49)
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-12">
        <p className="text-[16px] text-neg">Could not load, retry</p>
        <button onClick={() => refetch()} className="min-h-[44px] min-w-[44px] rounded-xl bg-mob-bg-card border border-mob-line px-6 text-[16px] text-mob-ink">
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="space-y-2">{[0,1,2,3].map(i => <div key={i} className="skeleton h-[80px] rounded-xl" />)}</div>;
  }

  // Empty state (only when not stale)
  if (!data?.notifications.length) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-12">
        <p className="text-[16px] text-mob-muted">Inbox is empty</p>
        <p className="text-[14px] text-mob-muted/60">
          {data?.source === 'pending' ? 'Notifications populate once contracts deploy' : 'Nothing to flag right now'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[16px] text-mob-ink">{unreadCount} unread</p>
        <button onClick={markAllRead} className="min-h-[44px] px-3 text-[14px] text-mob-accent">
          Mark all read
        </button>
      </div>

      {/* List */}
      {data.notifications.map(n => {
        const url = arbiscanTxUrl(n.txHash);
        const stripeColor = n.severity === 'danger' ? 'bg-neg' : n.severity === 'warning' ? 'bg-testnet' : 'bg-mob-accent';
        return (
          <div key={n.id} className="flex h-[80px] overflow-hidden rounded-xl border border-mob-line bg-mob-bg-card">
            <div className={`w-1 shrink-0 ${stripeColor}`} />
            <div className="flex flex-1 items-center gap-3 px-3">
              <div className="flex-1 min-w-0">
                <p className="truncate text-[16px] text-mob-ink">{n.title}</p>
                <p className="truncate text-[14px] text-mob-muted">{n.meta}</p>
                <p className="text-[12px] text-mob-muted/60">{n.timestamp}</p>
              </div>
              {url && (
                <a href={url} target="_blank" rel="noreferrer" className="min-h-[44px] min-w-[44px] grid place-items-center text-[12px] text-mob-accent">
                  ↗
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
