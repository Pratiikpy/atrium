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
    enabled: wallet != null, // disconnected -> no authed fetch (no 401)
  });

  const unreadCount = (data?.notifications ?? []).filter(n => !n.read).length;
  const hasList = (data?.notifications.length ?? 0) > 0;

  // Audit fix (use-everything sweep 2026-06-02): the "Mark all read" button
  // POSTed to /api/notifications/mark-read, which does not exist (404). Read
  // state is not persisted server-side (notifications are GET-only aggregated
  // Scribe events), so the action did nothing but error. Removed the button
  // below rather than ship a control that silently fails; it returns when a
  // real read-state endpoint exists.

  // Always render the "Inbox" page header so the mobile screen has chrome in
  // every state (loading/error/empty/list). Pre-fix the empty + error states
  // were a stranded centered line with no title, unlike the desktop header.
  const Header = (
    <div className="mb-3 flex items-baseline justify-between" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[22px] italic text-mob-ink">Inbox</h2>
        {hasList && unreadCount > 0 && (
          <span className="font-mono text-[11px] uppercase tracking-wider text-mob-muted">{unreadCount} unread</span>
        )}
      </div>
    </div>
  );

  // Error state (distinct from empty, E2E-15, E2E-49)
  if (error) {
    return (
      <div className="flex flex-col">
        {Header}
        <div className="flex flex-col items-center gap-4 px-4 py-12">
          <p className="text-[16px] text-neg">Could not load, retry</p>
          <button onClick={() => refetch()} className="min-h-[44px] min-w-[44px] rounded-xl bg-mob-bg-card border border-mob-line px-6 text-[16px] text-mob-ink">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col">
        {Header}
        <div className="space-y-2">{[0,1,2,3].map(i => <div key={i} className="skeleton h-[80px] rounded-xl" />)}</div>
      </div>
    );
  }

  // Empty state (only when not stale)
  if (!data?.notifications.length) {
    return (
      <div className="flex flex-col">
        {Header}
        <div className="flex flex-col items-center gap-2 px-4 py-16">
          <p className="text-[16px] text-mob-muted">Inbox is empty</p>
          <p className="text-[14px] text-mob-muted/60 text-center">
            {data?.source === 'pending' ? 'Notifications populate once contracts deploy' : 'Nothing to flag right now'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {Header}

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
