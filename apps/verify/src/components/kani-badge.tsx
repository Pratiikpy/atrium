'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Kani CI badge, judge-facing surface per ui.md §Verifier Mode rules.
 *
 * A11Y-07: Wrapped in a persistent aria-live region so status transitions
 * (checking → pass/fail/unknown) are announced to screen readers.
 */
interface KaniStatus {
  state: 'pass' | 'fail' | 'unknown';
  passed: number | null;
  total: number;
  last_run_at: string | null;
  proof_run_url: string | null;
  source: string;
}

export function KaniBadge() {
  const [status, setStatus] = useState<KaniStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/kani/status')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status_${r.status}`))))
      .then((s: KaniStatus) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A11Y-07: persistent wrapper ensures aria-live announces state changes
  return (
    <div aria-live="polite" aria-atomic="true">
      {failed ? (
        <Link
          href="/security#audit-findings-register"
          className="fixed right-4 bottom-4 z-40 hidden md:inline-flex items-center gap-2 rounded-md border border-divider bg-parchment px-3 py-1.5 text-xs font-medium text-ink-soft shadow-sm hover:text-ink"
          title="Kani status fetch failed"
        >
          <span className="size-2 rounded-full bg-testnet" aria-hidden />
          Kani CI · status unavailable
        </Link>
      ) : !status ? (
        <span className="fixed right-4 bottom-4 z-40 hidden md:inline-flex items-center gap-2 rounded-md border border-divider bg-parchment px-3 py-1.5 text-xs font-medium text-ink-soft shadow-sm">
          <span className="size-2 rounded-full bg-muted/40" aria-hidden />
          Kani CI · checking
        </span>
      ) : (
        <KaniBadgeResolved status={status} />
      )}
    </div>
  );
}

function KaniBadgeResolved({ status }: { status: KaniStatus }) {
  const dotColor =
    status.state === 'pass'
      ? 'bg-live'
      : status.state === 'fail'
      ? 'bg-neg'
      : 'bg-testnet';
  const linkHref = status.proof_run_url ?? '/security#audit-findings-register';
  const hasMeasurement = status.passed != null;
  const titleText = !hasMeasurement
    ? 'Kani CI status not yet wired (target: Month 2 W1). Total proofs in repo: ' + status.total
    : `${status.passed} of ${status.total} Kani invariants in CI · last run ${status.last_run_at ?? 'n/a'}`;
  const visibleText = !hasMeasurement
    ? `Kani CI · status pending (${status.total} proofs)`
    : `Kani CI · ${status.passed} of ${status.total}`;

  return (
    <Link
      href={linkHref as any}
      className="fixed right-4 bottom-4 z-40 hidden md:inline-flex items-center gap-2 rounded-md border border-divider bg-parchment px-3 py-1.5 text-xs font-medium text-ink-soft shadow-sm hover:text-ink"
      title={titleText}
    >
      <span className={`size-2 rounded-full ${dotColor}`} aria-hidden />
      {visibleText}
    </Link>
  );
}
