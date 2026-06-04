'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ATRIUM_ADMIN_WALLETS ?? '').split(',').filter(Boolean);

interface HealthData {
  indexedBlock: number;
  chainHead: number;
  blockLag: number;
  lastIndexedAt: string;
}

export default function ScribeHealthPage() {
  const [history, setHistory] = useState<{ lag: number; ts: number }[]>([]);
  const [wallet, setWallet] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('atrium_connected_wallet');
    setWallet(stored);
  }, []);

  // Poll /api/scribe/health on the codebase-standard TanStack Query
  // refetchInterval, not a raw setInterval (see the no-fake-latency
  // invariant; setInterval is reserved for fake-latency simulation).
  const { data: health, error, dataUpdatedAt } = useQuery<HealthData, Error>({
    queryKey: ['scribe-health-internal'],
    queryFn: async () => {
      const res = await fetch('/api/scribe/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as HealthData;
    },
    refetchInterval: 60_000,
  });
  const errorMsg = error ? error.message : null;

  // Accumulate a rolling 60-point lag history, one point per successful
  // poll. Keyed on dataUpdatedAt so it appends exactly once per fetch
  // (even when blockLag is unchanged) and never on unrelated re-renders.
  useEffect(() => {
    if (!health || !dataUpdatedAt) return;
    setHistory((prev) => [...prev.slice(-59), { lag: health.blockLag, ts: dataUpdatedAt }]);
  }, [dataUpdatedAt, health]);

  // Admin gate: check wallet against allowlist
  if (ADMIN_WALLETS.length > 0 && (!wallet || !ADMIN_WALLETS.includes(wallet.toLowerCase()))) {
    return (
      <main className="min-h-screen bg-parchment p-8 text-ink max-sm:bg-mob-bg max-sm:text-mob-ink">
        <h1 className="text-xl font-semibold">Access Denied</h1>
        <p className="mt-2 text-sm text-neutral-500 max-sm:text-mob-muted">
          This page is restricted to admin wallets. Connect an authorized wallet.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-parchment p-8 text-ink max-sm:bg-mob-bg max-sm:text-mob-ink md:max-w-3xl md:mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Scribe Indexer Health</h1>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700 max-sm:border-neg/40 max-sm:bg-neg/10 max-sm:text-mob-ink">
          Error: {errorMsg}
        </div>
      )}

      {health && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Stat label="Indexed Block" value={health.indexedBlock.toLocaleString()} />
          <Stat label="Chain Head" value={health.chainHead.toLocaleString()} />
          <Stat label="Block Lag" value={String(health.blockLag)} warn={health.blockLag > 100} />
          <Stat label="Last Indexed" value={new Date(health.lastIndexedAt).toLocaleTimeString()} />
        </div>
      )}

      <h2 className="text-lg font-medium mb-3">Lag History (last hour)</h2>
      <div className="flex items-end gap-px h-32 bg-neutral-100 rounded p-2 max-sm:bg-mob-bg-card">
        {history.map((point, i) => {
          const maxLag = Math.max(...history.map((h) => h.lag), 1);
          const height = Math.max((point.lag / maxLag) * 100, 2);
          return (
            <div
              key={i}
              className={`flex-1 rounded-t ${point.lag > 200 ? 'bg-red-400' : point.lag > 100 ? 'bg-yellow-400' : 'bg-green-400'}`}
              style={{ height: `${height}%` }}
              title={`Lag: ${point.lag} at ${new Date(point.ts).toLocaleTimeString()}`}
            />
          );
        })}
      </div>

      <p className="mt-4 text-xs text-neutral-500 max-sm:text-mob-muted">
        Polls /api/scribe/health every 60s. Per-handler tick latency available in New Relic custom metrics.
      </p>
    </main>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-white border rounded p-3 max-sm:border-mob-line max-sm:bg-mob-bg-card">
      <div className="text-xs text-neutral-500 max-sm:text-mob-muted">{label}</div>
      <div className={`text-lg font-mono ${warn ? 'text-red-600 max-sm:text-neg' : 'max-sm:text-mob-ink'}`}>{value}</div>
    </div>
  );
}
