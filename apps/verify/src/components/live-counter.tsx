'use client';

import { useScribeCount } from '@/lib/scribe';

/**
 * A counter rendered from a live Scribe (subgraph) query. If the count is
 * zero or the query fails, shows the empty-state fallback. Never invents a
 * number — per CLAUDE.md.
 */
export function LiveCounter({
  label,
  scribeQuery,
  emptyFallback,
}: {
  label: string;
  scribeQuery: string;
  emptyFallback: string;
}) {
  const { count, isLoading, error } = useScribeCount(scribeQuery);

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink" aria-live="polite">
        {isLoading ? (
          <span className="skeleton inline-block h-10 w-24" aria-label="loading" />
        ) : error ? (
          <span className="text-muted text-base">Source unavailable</span>
        ) : count === 0 ? (
          <span className="text-muted text-base">{emptyFallback}</span>
        ) : (
          count.toLocaleString('en-US')
        )}
      </p>
      <p className="mt-1 text-xs text-muted">
        Source: Scribe subgraph · refreshes every 30 s
      </p>
    </div>
  );
}
