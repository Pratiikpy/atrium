'use client';

import { useQuery } from '@tanstack/react-query';

interface Gas {
  sponsored: number | null;
  cap: number;
  active: boolean;
  source: 'postern' | 'pending';
}

// Audit TTT-4 fix: pre-fix the catch returned `sponsored: 0`. A user who
// had actually consumed 5 of 10 sponsorships would see "0 / 10 sponsored"
// on any API failure, contradicting the "pending" status pill. The cap
// (10) is a static product parameter sourced from the header copy
// ("first ten UserOperations") and stays; only the user-specific count
// becomes nullable so the UI renders "— / 10" honestly.
async function fetchGas(): Promise<Gas> {
  try {
    const r = await fetch('/api/settings/gas');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { sponsored: null, cap: 10, active: false, source: 'pending' };
  }
}

export function GasSponsorshipCard() {
  const { data } = useQuery({ queryKey: ['settings-gas'], queryFn: fetchGas, refetchInterval: 60_000 });
  const pct = data?.cap && data?.sponsored != null
    ? Math.max(0, Math.min(100, (data.sponsored / data.cap) * 100))
    : 0;
  return (
    <section className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="font-display text-xl italic text-ink">Gas sponsorship</p>
          <p className="mt-0.5 text-sm text-muted">Atrium pays gas for your first ten UserOperations</p>
        </div>
        <span className={
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ' +
          (data?.active ? 'border-success/30 bg-success-soft text-success' : 'border-divider bg-parchment-soft/60 text-muted')
        }>
          <span className={'size-1.5 rounded-full ' + (data?.active ? 'bg-success' : 'bg-muted')} />
          {data?.active ? 'active' : 'pending'}
        </span>
      </header>

      <div className="mt-4 flex items-baseline justify-between text-[10px] uppercase tracking-wider text-muted">
        <span>UserOps sponsored</span>
        <span className="font-mono text-sm text-ink">
          {data?.sponsored ?? '—'} / {data?.cap ?? 10}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-pill bg-divider-soft">
        <div className="h-full bg-ink transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-[9px] uppercase tracking-wider text-muted">
        Resets monthly. Subsidised from Codex revenue after launch.
      </p>
    </section>
  );
}
