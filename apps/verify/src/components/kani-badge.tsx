'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Kani CI badge — judge-facing surface per ui.md §Verifier Mode rules.
 *
 * Audit J-C1 fix: the badge now fetches `/api/kani/status` which reads the
 * actual CI state (or returns `unknown` honestly when no upstream is
 * configured). The "3 of 5" green dot is no longer hardcoded; passing /
 * failing / unknown each render their own state so the badge can never
 * lie about CI on judge day.
 */
interface KaniStatus {
  state: 'pass' | 'fail' | 'unknown';
  /**
   * Iteration 38: was `number`. Now `number | null` — null means "no
   * measurement available" (no env, no CI artifact). Pre-fix `0` was used
   * for both "0 proofs passed" (measured) and "no measurement" (unmeasured),
   * making the badge say "Kani CI · 0 of 6" with the misleading implication
   * that 0 proofs passed CI. Now those cases render differently.
   */
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

  if (failed) {
    return (
      <Link
        href="/security#audit-findings-register"
        className="fixed right-4 bottom-4 z-40 hidden md:inline-flex items-center gap-2 rounded-md border border-divider bg-parchment px-3 py-1.5 text-xs font-medium text-ink-soft shadow-sm hover:text-ink"
        title="Kani status fetch failed"
      >
        <span className="size-2 rounded-full bg-testnet" aria-hidden />
        Kani CI · status unavailable
      </Link>
    );
  }
  if (!status) {
    return (
      <span
        className="fixed right-4 bottom-4 z-40 hidden md:inline-flex items-center gap-2 rounded-md border border-divider bg-parchment px-3 py-1.5 text-xs font-medium text-ink-soft shadow-sm"
        aria-live="polite"
      >
        <span className="size-2 rounded-full bg-muted/40" aria-hidden />
        Kani CI · checking
      </span>
    );
  }

  const dotColor =
    status.state === 'pass'
      ? 'bg-live'
      : status.state === 'fail'
      ? 'bg-neg'
      : 'bg-testnet';
  const linkHref = status.proof_run_url ?? '/security#audit-findings-register';
  // Iteration 38 audit fix: pre-fix the visible text was always
  // `${passed} of ${total}` even when state was 'unknown' (no measurement).
  // The tooltip said "not yet wired" but visible text rendered "0 of 6" —
  // looks like 0 proofs passed. Now: when passed is null, surface the
  // pending state in the visible text too, not just the tooltip.
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
