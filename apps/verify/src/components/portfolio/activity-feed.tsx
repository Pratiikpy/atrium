'use client';

import { useQuery } from '@tanstack/react-query';
import { arbiscanTxUrl } from '@/lib/arbiscan';

interface Activity {
  id: string;
  kind: 'tx' | 'attestation' | 'mandate' | 'liquidation';
  title: string;
  meta: string;
  timestamp: string;
  txHash?: string;
}

interface ActivityResponse {
  activities: Activity[];
  source: 'scribe' | 'pending';
}

async function fetchActivity(): Promise<ActivityResponse> {
  const r = await fetch('/api/portfolio/activity');
  if (!r.ok) throw new Error(`activity_${r.status}`);
  return r.json();
}

export function ActivityFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivity,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!data?.activities.length) {
    return (
      <div className="rounded-md border border-divider bg-parchment-soft/40 p-6 text-center">
        <p className="text-sm text-ink-soft">Live feed will populate from Scribe.</p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">scribe pending</p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {data.activities.map((a) => (
        <li key={a.id} className="rounded-md border border-divider bg-parchment p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-medium text-ink">{a.title}</p>
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">
              {a.timestamp}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">{a.meta}</p>
          {(() => {
            // Audit SS-1 fix: shared arbiscanTxUrl validates the hash before
            // building the URL.
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
