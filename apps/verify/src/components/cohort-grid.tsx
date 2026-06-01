'use client';

import { useQuery } from '@tanstack/react-query';
import { gql, type CohortPartner } from '@/lib/scribe-helpers';
import { parseTsOrNull } from '@/lib/format-time';

/**
 * Audit NN-4 + NN-5 fix: Scribe returns BigInt-as-string for numeric fields.
 * Prior code did `Number(p.joinedAtTimestamp) * 1000` → if Scribe returned
 * a corrupt value (`"NaN"`, `"abc"`, empty), `Number()` produced NaN and
 * `new Date(NaN).toLocaleDateString()` rendered the literal string
 * "Invalid Date" in the partners grid. Now: validate first, render "-" on
 * any malformed value.
 *
 * Same gate applies to `totalDepositsWei`, a huge Scribe value would lose
 * precision past Number.MAX_SAFE_INTEGER and render a corrupt number.
 */
function formatScribeDate(s: string | null | undefined): string {
  const ts = parseTsOrNull(s);
  if (ts == null) return '-';
  return new Date(ts * 1000).toLocaleDateString();
}

function formatScribeUsdc(s: string | null | undefined): string {
  if (s == null || s === '' || !/^\d+$/.test(s)) return '-';
  // Locale-format USDC (6 decimals) without the $ sign, caller adds it.
  // Use string-arithmetic to preserve precision past safe-int.
  const whole = s.length > 6 ? s.slice(0, -6) : '0';
  const wholeNum = Number(whole);
  if (!Number.isFinite(wholeNum)) return '-';
  return wholeNum.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

async function fetchPartners(): Promise<CohortPartner[]> {
  try {
    const data = await gql<{ cohortPartners: CohortPartner[] }>(`
      query Cohort {
        cohortPartners(orderBy: joinedAtTimestamp, orderDirection: desc) {
          id
          displayName
          joinedAtTimestamp
          totalDepositsWei
          totalTradesCount
          lastActionTimestamp
        }
      }
    `);
    return data.cohortPartners;
  } catch {
    return [];
  }
}

export function CohortGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ['cohort-partners'],
    queryFn: fetchPartners,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-md" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-12 rounded-md border border-divider bg-parchment p-8 text-center">
        <p className="text-ink-soft">No Cohort partners yet.</p>
        <p className="mt-2 text-sm text-muted">
          Partners appear here once they have signed and made their first testnet deposit.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((p) => (
        <li
          key={p.id}
          className="rounded-md border border-divider bg-parchment p-6"
        >
          <p className="font-display text-xl text-ink">{p.displayName ?? `${p.id.slice(0, 6)}…${p.id.slice(-4)}`}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Joined</dt>
              <dd className="text-ink">{formatScribeDate(p.joinedAtTimestamp)}</dd>
            </div>
            <div>
              <dt className="text-muted">Deposits</dt>
              <dd className="text-ink">${formatScribeUsdc(p.totalDepositsWei)}</dd>
            </div>
            <div>
              <dt className="text-muted">Trades</dt>
              <dd className="text-ink">{p.totalTradesCount}</dd>
            </div>
            <div>
              <dt className="text-muted">Last action</dt>
              <dd className="text-ink">{formatScribeDate(p.lastActionTimestamp)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
