'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { venueLabel } from '@/lib/venues';
import { useClosePosition } from '@/lib/use-close-position';
import { EmergencyCloseBanner, isLiquidityError } from '@/components/portfolio/emergency-close-banner';

interface Position {
  id: string;
  /** On-chain Plinth position id surfaced for the Close action (audit U-21). */
  venuePositionId?: string;
  instrument: string;
  venue: string;
  venueId?: number;
  size: string;
  notionalUsd: string;
  /** null when the subgraph hasn't observed the entry price yet (audit U-33). */
  entryPrice: string | null;
  // Audit U-21: pre-fix `markPrice` and `pnlUsd` were strings echoing fake
  // measurements ("entry · entry · $0.00 PnL"). Both are nullable now —
  // the route returns null until the mark-oracle path lands. Component
  // renders "—" with a "pending" caption for null.
  markPrice: string | null;
  pnlUsd: string | null;
  pnlDirection: 'up' | 'down' | 'flat' | null;
  markSource?: 'pending' | 'pyth' | 'chainlink';
}

interface PositionsResponse {
  positions: Position[];
  source: 'scribe' | 'pending';
}

async function fetchPositions(): Promise<PositionsResponse> {
  const r = await fetch('/api/portfolio/positions');
  if (!r.ok) throw new Error(`positions_${r.status}`);
  return r.json();
}

/**
 * Audit P-11 fix: accepts a `filterVenueId` prop so the parent's pill bar
 * can filter without re-fetching. `null` (or undefined) shows all venues.
 */
export function OpenPositionsTable({ filterVenueId }: { filterVenueId?: number | null } = {}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['open-positions'],
    queryFn: fetchPositions,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/5 p-6 text-sm">
        <p className="font-medium text-danger">Could not load positions</p>
        <p className="mt-1 text-ink-soft">Scribe is unreachable. Falling back to direct Plinth read failed too.</p>
      </div>
    );
  }

  const filtered = filterVenueId == null
    ? data?.positions ?? []
    : (data?.positions ?? []).filter((p) => p.venueId === filterVenueId || p.venue === venueLabel(filterVenueId));

  if (!filtered.length) {
    // Iteration 39 audit fix: distinguish "real-measured-zero" (source=scribe,
    // empty array) from "couldn't-measure-yet" (source=pending). Pre-fix both
    // rendered the same main text "No open positions on this wallet" — a
    // user during a Scribe outage would read it as a confirmed measurement
    // when actually no measurement was available. Now the main text flips
    // based on source; the sub-label continues to name the unblock action.
    const isPending = data?.source === 'pending';
    const filtersActive = filterVenueId != null && (data?.positions.length ?? 0) > 0;
    const mainText = isPending
      ? 'Positions data is not yet available.'
      : filtersActive
      ? `No open positions on ${venueLabel(filterVenueId)}.`
      : 'No open positions on this wallet.';
    return (
      <div className="rounded-md border border-divider bg-parchment-soft/40 p-12 text-center">
        <p className="text-sm text-ink-soft">{mainText}</p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
          {isPending ? 'scribe pending · contracts deploy month 1 w2' : 'open one from Trade'}
        </p>
      </div>
    );
  }

  return <PositionsTableBody positions={filtered} />;
}

/**
 * Inner table that owns the close-position state machine. Split into its
 * own component so a single `useClosePosition` instance services every
 * row's button via the row's `venuePositionId`.
 */
function PositionsTableBody({ positions }: { positions: Position[] }) {
  const { status, close, reset } = useClosePosition();
  // Track which row should show the emergency-close banner. Set when a
  // close errors with a liquidity-shaped reason. Cleared on dismiss or
  // when the user retries the normal close (which clears `status`).
  const [emergencyForId, setEmergencyForId] = useState<string | null>(null);
  useEffect(() => {
    if (status.kind === 'error' && isLiquidityError(status.reason)) {
      setEmergencyForId(status.positionId);
    } else if (status.kind === 'idle' || status.kind === 'success') {
      setEmergencyForId(null);
    }
  }, [status]);
  const erroredPosition = emergencyForId
    ? positions.find((p) => p.venuePositionId === emergencyForId)
    : null;
  return (
    <div className="overflow-x-auto rounded-md border border-divider bg-parchment">
      <table className="w-full text-sm">
        <thead className="border-b border-divider">
          <tr className="text-left text-[10px] uppercase tracking-wider text-label">
            <th className="px-4 py-3 font-normal">Instrument</th>
            <th className="px-4 py-3 font-normal">Venue</th>
            <th className="px-4 py-3 font-normal">Size</th>
            <th className="px-4 py-3 font-normal">Notional</th>
            <th className="px-4 py-3 font-normal">Entry · Mark</th>
            <th className="px-4 py-3 font-normal">PnL</th>
            <th className="px-4 py-3 font-normal" />
          </tr>
        </thead>
        <tbody className="divide-y divide-divider-soft">
          {positions.map((p) => {
            const rowActive = Boolean(
              p.venuePositionId &&
                status.kind !== 'idle' &&
                status.positionId === p.venuePositionId,
            );
            const rowBusy =
              rowActive && (status.kind === 'resolving' || status.kind === 'submitting');
            return (
              <tr key={p.id} className="hover:bg-parchment-soft/40">
                <td className="px-4 py-3 font-mono text-ink">{p.instrument}</td>
                <td className="px-4 py-3 text-ink-soft">{p.venue}</td>
                <td className="px-4 py-3 font-mono text-ink-soft">{p.size}</td>
                <td className="px-4 py-3 font-mono text-ink">{p.notionalUsd}</td>
                <td className="px-4 py-3 font-mono text-ink-soft">
                  {p.entryPrice ?? <span className="text-muted" title="entry price pending subgraph event-v2 extension">—</span>}
                  <span className="mx-1 text-muted">·</span>
                  {p.markPrice ?? <span className="text-muted" title="mark price pending oracle">—</span>}
                </td>
                <td
                  className={
                    'px-4 py-3 font-mono ' +
                    (p.pnlUsd == null
                      ? 'text-muted'
                      : p.pnlDirection === 'up'
                      ? 'text-success'
                      : p.pnlDirection === 'down'
                      ? 'text-danger'
                      : 'text-ink')
                  }
                  title={p.pnlUsd == null ? 'PnL pending mark-oracle wiring' : undefined}
                >
                  {p.pnlUsd == null
                    ? '—'
                    : (p.pnlDirection === 'up' ? '+' : '') + p.pnlUsd}
                </td>
                <td className="px-4 py-3 text-right">
                  {p.venuePositionId && p.venueId != null ? (
                    rowActive && status.kind === 'success' ? (
                      <a
                        href={`https://sepolia.arbiscan.io/tx/${status.hash}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-mono text-xs text-success underline"
                      >
                        closed ↗
                      </a>
                    ) : rowActive && status.kind === 'error' ? (
                      <button
                        type="button"
                        onClick={reset}
                        className="text-xs text-danger underline"
                        title={status.reason}
                      >
                        retry
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() =>
                          close({
                            venueId: p.venueId!,
                            venuePositionId: p.venuePositionId!,
                          })
                        }
                        className="rounded-md border border-divider px-2.5 py-1 text-xs text-ink-soft hover:border-ink/30 hover:text-ink disabled:opacity-50"
                      >
                        {rowBusy ? '…' : 'Close'}
                      </button>
                    )
                  ) : (
                    <span className="text-[10px] text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {erroredPosition && (
        <div className="border-t border-divider-soft p-3">
          <EmergencyCloseBanner
            instrument={erroredPosition.instrument}
            reason={status.kind === 'error' ? status.reason : 'unknown'}
            onClose={() => {
              setEmergencyForId(null);
              reset();
            }}
          />
        </div>
      )}
    </div>
  );
}
