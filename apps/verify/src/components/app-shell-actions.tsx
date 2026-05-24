'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

/**
 * Topbar action cluster — Notifications · Refresh · New trade.
 *
 * Split out as a `'use client'` component so the AppShell itself can stay a
 * server component. Audit P-11 fix: Refresh now actually calls
 * `queryClient.invalidateQueries()` (it was a dead button before).
 * Notifications opens the in-app notifications drawer; until the drawer
 * ships, it links to the Codex `/notifications` endpoint.
 */
export function AppShellActions() {
  const qc = useQueryClient();
  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1.5 rounded-full border border-success/30 bg-success/5 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-success sm:inline-flex">
        <span className="size-1.5 rounded-full bg-success" />
        live · arb-sepolia
      </span>
      <Link
        href="/app/notifications"
        aria-label="Notifications inbox"
        className="rounded-md border border-divider bg-parchment-light p-2 text-ink-soft hover:text-ink"
      >
        <BellIcon />
      </Link>
      <button
        type="button"
        aria-label="Refresh all data"
        onClick={() => qc.invalidateQueries()}
        className="rounded-md border border-divider bg-parchment-light p-2 text-ink-soft transition-colors hover:text-ink active:bg-parchment-soft"
      >
        <RefreshIcon />
      </button>
      <Link
        href="/app/trade"
        className="inline-flex items-center gap-2 rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-parchment hover:bg-ink-dark"
      >
        <span aria-hidden>+</span> New trade
      </Link>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11V7a4 4 0 018 0v4l1 1H3l1-1z" />
      <path d="M7 13a1 1 0 002 0" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8a5 5 0 019-3M13 8a5 5 0 01-9 3" />
      <path d="M12 2v3h-3M4 14v-3h3" />
    </svg>
  );
}
