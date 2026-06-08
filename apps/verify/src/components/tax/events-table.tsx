'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { TaxJurisdiction, TaxYear } from './tax-types';

interface TaxEvent {
  id: string;
  date: string;
  asset: string;
  eventLabel: string;
  proceedsUsd: string;
  costBasisUsd: string;
  gainUsd: string;
  gainDirection: 'up' | 'down' | 'flat';
}
interface Resp { events: TaxEvent[]; source: 'scribe' | 'pending'; }

async function fetchEvents(jurisdiction: TaxJurisdiction, year: TaxYear): Promise<Resp> {
  try {
    const r = await fetch(`/api/tax/events?jurisdiction=${jurisdiction}&year=${year}`);
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { events: [], source: 'pending' };
  }
}

export function TaxEventsTable({
  jurisdiction,
  year,
}: {
  jurisdiction: TaxJurisdiction;
  year: TaxYear;
}) {
  const { isConnected } = useAccount();
  const { data, isLoading } = useQuery({
    queryKey: ['tax-events', jurisdiction, year],
    queryFn: () => fetchEvents(jurisdiction, year),
    refetchInterval: 60_000,
    enabled: isConnected,
  });

  if (isLoading) {
    return <div className="space-y-2">{[0,1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-md" />)}</div>;
  }
  if (!data?.events.length) {
    return (
      <div className="rounded-md border border-divider bg-parchment-soft/40 p-12 text-center text-sm">
        <p className="text-ink-soft">No realised events yet.</p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
          {data?.source === 'pending' ? 'Tablet tax data appears after a realized (closed) trade' : 'open and close a position to record one'}
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-divider bg-parchment">
      <table className="w-full text-sm">
        <thead className="border-b border-divider">
          <tr className="text-left text-[10px] uppercase tracking-wider text-label">
            <th className="px-4 py-3 font-normal">Date</th>
            <th className="px-4 py-3 font-normal">Asset</th>
            <th className="px-4 py-3 font-normal">Event</th>
            <th className="px-4 py-3 font-normal">Proceeds</th>
            <th className="px-4 py-3 font-normal">Cost basis</th>
            <th className="px-4 py-3 font-normal">Gain</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider-soft">
          {data.events.map((e) => (
            <tr key={e.id} className="hover:bg-parchment-soft/40">
              <td className="px-4 py-3 font-mono text-xs text-muted">{e.date}</td>
              <td className="px-4 py-3 font-mono text-ink">{e.asset}</td>
              <td className="px-4 py-3 text-ink-soft">{e.eventLabel}</td>
              <td className="px-4 py-3 font-mono text-ink">{e.proceedsUsd}</td>
              <td className="px-4 py-3 font-mono text-ink-soft">{e.costBasisUsd}</td>
              <td className={
                'px-4 py-3 font-mono ' +
                (e.gainDirection === 'up' ? 'text-live' : e.gainDirection === 'down' ? 'text-neg' : 'text-ink')
              }>
                {e.gainDirection === 'up' && '+'}
                {e.gainUsd}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
