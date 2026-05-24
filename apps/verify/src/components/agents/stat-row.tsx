'use client';

import { useQuery } from '@tanstack/react-query';

interface AgentsSummary {
  activeMandates: number | null;
  activeSessionKeys: number | null;
  totalCapacityUsd: string | null;
  capacityUsedPct: number | null;
  agentsCopied: number | null;
  agentsByVenues: string | null;
  feesPaidUsd: string | null;
  feeAgentsCount: number | null;
  source: 'scribe' | 'pending';
}

// Audit TTT-1 + TTT-2 fix: pre-fix the catch block returned 0s for
// activeMandates / activeSessionKeys / agentsCopied / feeAgentsCount and
// hardcoded "across HL · Pendle · Aave" as a fake venue list. UI rendered
// "0 active mandates / 0 session keys / across HL · Pendle · Aave" on any
// API failure — even if the user had real mandates. A user with 3 active
// mandates seeing "0 active mandates" might panic-press Kill Switch
// thinking their delegation got revoked. Same RRR-5/6 misleading-data
// pattern as the tax surface. Now: nulls + source='pending' → tiles render
// "—" sentinels and the Tile sub copy honestly says "pending".
async function fetchSummary(): Promise<AgentsSummary> {
  try {
    const r = await fetch('/api/agents/summary');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return {
      activeMandates: null,
      activeSessionKeys: null,
      totalCapacityUsd: null,
      capacityUsedPct: null,
      agentsCopied: null,
      agentsByVenues: null,
      feesPaidUsd: null,
      feeAgentsCount: null,
      source: 'pending',
    };
  }
}

export function AgentsStatRow() {
  const { data } = useQuery({ queryKey: ['agents-summary'], queryFn: fetchSummary, refetchInterval: 30_000 });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        label="Active mandates"
        value={data?.activeMandates?.toString() ?? '—'}
        sub={data?.activeSessionKeys != null ? `${data.activeSessionKeys} session keys` : 'session keys pending'}
      />
      <Tile
        label="Total capacity"
        value={data?.totalCapacityUsd ?? '—'}
        sub={data?.capacityUsedPct != null ? `${data.capacityUsedPct}% used` : 'pending'}
      />
      <Tile
        label="Agents copied"
        value={data?.agentsCopied?.toString() ?? '—'}
        sub={data?.agentsByVenues ?? 'venue breakdown pending'}
      />
      <Tile
        label="Fees paid · 30d"
        value={data?.feesPaidUsd ?? '—'}
        sub={data?.feeAgentsCount != null ? `to ${data.feeAgentsCount} agent operators` : 'fees pending'}
      />
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border border-divider bg-parchment p-4">
      <p className="text-[10px] uppercase tracking-wider text-label">{label}</p>
      <p className="mt-2 font-mono text-2xl text-ink">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">{sub}</p>
    </div>
  );
}
