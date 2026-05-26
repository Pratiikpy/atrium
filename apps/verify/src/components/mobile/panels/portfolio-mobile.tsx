'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

/**
 * PortfolioMobile  the Home panel for /app/portfolio at < md.
 * Source: design/Mobile App.html:910-1061 (hero card + 4-action grid +
 * positions list + activity feed). Renders the same /api/portfolio/*
 * data as the desktop variant, just stacked for thumb-reach.
 */

interface BuyingPower {
  currentUsd: string | null;
  series: { ts: number; valueUsd: string }[];
  windowDays: number;
  source: 'plinth' | 'pending';
}

interface PortfolioSummary {
  totalAccountValueUsd: string | null;
  totalRequiredMarginUsd: string | null;
  totalNotionalUsd: string | null;
  pnl24hUsd: string | null;
  pnl24hDirection: 'up' | 'down' | 'flat' | null;
  source: 'plinth' | 'pending';
}

interface Position {
  id: string;
  instrument: string;
  venue: string;
  venueId: number;
  size: string;
  notionalUsd: string;
  pnlUsd: string | null;
  pnlDirection: 'up' | 'down' | 'flat' | null;
}

interface Activity {
  id: string;
  kind: string;
  title: string;
  meta: string;
  timestamp: string;
  txHash?: string;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}_${r.status}`);
  return r.json();
}

export function PortfolioMobile() {
  const bp = useQuery({
    queryKey: ['mobile-bp'],
    queryFn: () => fetchJSON<BuyingPower>('/api/portfolio/buying-power?window=7d'),
    refetchInterval: 60_000,
  });
  const summary = useQuery({
    queryKey: ['mobile-summary'],
    queryFn: () => fetchJSON<PortfolioSummary>('/api/portfolio/summary'),
    refetchInterval: 60_000,
  });
  const positions = useQuery({
    queryKey: ['mobile-positions'],
    queryFn: () => fetchJSON<{ positions: Position[]; source: string }>('/api/portfolio/positions'),
    refetchInterval: 60_000,
  });
  const activity = useQuery({
    queryKey: ['mobile-activity'],
    queryFn: () => fetchJSON<{ activities: Activity[]; source: string }>('/api/portfolio/activity'),
    refetchInterval: 60_000,
  });

  const currentUsd = bp.data?.currentUsd ?? 'pending';
  const series = bp.data?.series ?? [];
  const delta = computeDelta(series);

  // Derive utilisation client side from required / collateral so the
  // hero card matches the desktop margin-engine bar without a new API.
  const utilisationPct = (() => {
    const col = parseUsd(summary.data?.totalAccountValueUsd);
    const req = parseUsd(summary.data?.totalRequiredMarginUsd);
    if (col == null || req == null || col === 0) return null;
    return (req / col) * 100;
  })();
  const openCount = positions.data?.positions?.length ?? null;

  return (
    <div className="md:hidden flex flex-col gap-5">
      {/* HERO buying power card */}
      <section className="relative overflow-hidden rounded-2xl border border-mob-line bg-mob-bg-card p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 30% 0%, color-mix(in oklch, var(--color-mob-accent) 12%, transparent), transparent 70%)',
          }}
        />
        <div className="relative">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">
            Buying power . 7 days
          </p>
          <p className="mt-2 font-display text-[40px] italic leading-none text-mob-ink">
            {bp.isLoading ? <span className="inline-block h-9 w-44 animate-pulse rounded bg-mob-bg-elev" /> : currentUsd}
          </p>
          <p className={`mt-1 font-mono text-[12px] ${delta.dir === 'up' ? 'text-mob-live' : delta.dir === 'down' ? 'text-mob-neg' : 'text-mob-muted'}`}>
            {delta.label}
          </p>

          <div className="mt-5 h-16">
            <Sparkline series={series} loading={bp.isLoading} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-mob-hairline pt-3 text-[11px]">
            <Meta label="Collateral" value={summary.data?.totalAccountValueUsd ?? 'pending'} />
            <Meta label="Open" value={openCount != null ? String(openCount) : 'pending'} />
            <Meta label="Utilisation" value={utilisationPct != null ? `${utilisationPct.toFixed(1)}%` : 'pending'} />
          </div>
        </div>
      </section>

      {/* 4-action grid */}
      <section className="grid grid-cols-4 gap-2.5">
        <ActionTile href="/app/trade"    label="Trade"    icon={<TradeIcon />} />
        <ActionTile href="/app/transfer" label="Move"     icon={<MoveIcon />} />
        <ActionTile href="/app/agents"   label="Agents"   icon={<AgentsIcon />} />
        <ActionTile href="/app/reserves" label="Reserves" icon={<ReservesIcon />} />
      </section>

      {/* Positions list */}
      <section>
        <header className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="font-display text-[20px] italic text-mob-ink">Positions</h2>
          <Link href="/app/portfolio" className="font-mono text-[10.5px] uppercase tracking-wider text-mob-muted hover:text-mob-ink">
            All
          </Link>
        </header>
        <ul className="overflow-hidden rounded-2xl border border-mob-line bg-mob-bg-card">
          {positions.isLoading && (
            <li className="p-5 text-center text-mob-muted">
              <span className="inline-block h-4 w-32 animate-pulse rounded bg-mob-bg-elev" />
            </li>
          )}
          {!positions.isLoading && (positions.data?.positions?.length ?? 0) === 0 && (
            <li className="p-5 text-center text-mob-muted text-[13px]">
              No positions yet
              <Link href="/app/trade" className="ml-2 underline">Open one</Link>
            </li>
          )}
          {positions.data?.positions?.slice(0, 4).map((p) => (
            <PositionRow key={p.id} p={p} />
          ))}
        </ul>
      </section>

      {/* Activity feed */}
      <section>
        <header className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="font-display text-[20px] italic text-mob-ink">Activity</h2>
          <Link href="/app/portfolio/activity" className="font-mono text-[10.5px] uppercase tracking-wider text-mob-muted hover:text-mob-ink">
            All
          </Link>
        </header>
        <ul className="overflow-hidden rounded-2xl border border-mob-line bg-mob-bg-card">
          {activity.isLoading && (
            <li className="p-5 text-center text-mob-muted">
              <span className="inline-block h-4 w-32 animate-pulse rounded bg-mob-bg-elev" />
            </li>
          )}
          {!activity.isLoading && (activity.data?.activities?.length ?? 0) === 0 && (
            <li className="p-5 text-center text-mob-muted text-[13px]">No activity yet</li>
          )}
          {activity.data?.activities?.slice(0, 4).map((a) => (
            <ActivityRow key={a.id} a={a} />
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ============ helpers ============ */

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-wider text-mob-muted">{label}</div>
      <div className="mt-0.5 font-mono text-[14px] text-mob-ink">{value}</div>
    </div>
  );
}

function ActionTile({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href as any}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-mob-line bg-mob-bg-card py-3.5 transition hover:border-mob-accent"
    >
      <span className="grid size-6 place-items-center text-mob-ink-soft">{icon}</span>
      <span className="text-[11px] text-mob-ink-soft">{label}</span>
    </Link>
  );
}

function PositionRow({ p }: { p: Position }) {
  const pnl = p.pnlUsd;
  const pnlColor =
    p.pnlDirection === 'up'   ? 'text-mob-live' :
    p.pnlDirection === 'down' ? 'text-mob-neg' :
                                'text-mob-muted';
  const initial = p.venue.charAt(0).toUpperCase();
  return (
    <li className="flex items-center gap-3 border-b border-mob-hairline px-4 py-3.5 last:border-b-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-mob-hairline bg-mob-bg-elev font-display text-[16px] italic text-mob-ink">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-mob-ink truncate">{p.venue}</div>
        <div className="text-[11px] text-mob-muted truncate">{p.instrument} . {p.size}</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[13px] text-mob-ink">{p.notionalUsd}</div>
        <div className={`font-mono text-[11px] ${pnlColor}`}>{pnl ?? 'pending'}</div>
      </div>
    </li>
  );
}

function ActivityRow({ a }: { a: Activity }) {
  return (
    <li className="flex items-center gap-3 border-b border-mob-hairline px-4 py-3 last:border-b-0">
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-mob-hairline bg-mob-bg-elev text-mob-ink-soft">
        <ActivityIcon kind={a.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-mob-ink truncate">{a.title}</div>
        <div className="font-mono text-[10.5px] text-mob-muted truncate">
          {a.timestamp} . {a.meta}
        </div>
      </div>
      {a.txHash && (
        <div className="font-mono text-[10.5px] text-mob-muted">{short(a.txHash)}</div>
      )}
    </li>
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  const cls = 'size-3.5';
  if (kind === 'deposit' || kind === 'transfer-in') {
    return <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v9M4 7l4 4 4-4M3 14h10" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (kind === 'withdraw' || kind === 'transfer-out') {
    return <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 11V2M4 6l4-4 4 4M3 14h10" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (kind === 'open' || kind === 'close') {
    return <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12l4-5 3 3 3-5M3 14h10" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  return <svg className={cls} viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="3" /></svg>;
}

function Sparkline({ series, loading }: { series: { ts: number; valueUsd: string }[]; loading: boolean }) {
  if (loading) {
    return <div className="h-full w-full animate-pulse rounded bg-mob-bg-elev" />;
  }
  if (!series || series.length < 2) {
    return (
      <div className="grid h-full place-items-center text-[10.5px] uppercase tracking-wider text-mob-muted">
        Plinth . live wire pending
      </div>
    );
  }
  const nums = series.map((p) => Number(String(p.valueUsd).replace(/[^0-9.\-]/g, '')));
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const w = 320;
  const h = 64;
  const points = nums.map((n, i) => {
    const x = (i / (nums.length - 1)) * w;
    const y = h - ((n - min) / range) * h * 0.85 - h * 0.075;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="mob-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-mob-accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-mob-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={points.join(' ')} stroke="var(--color-mob-accent)" strokeWidth="1.5" fill="none" />
      <polygon points={`0,${h} ${points.join(' ')} ${w},${h}`} fill="url(#mob-spark-fill)" />
    </svg>
  );
}

/* ============ tiny utils ============ */

function computeDelta(series: { ts: number; valueUsd: string }[]): { dir: 'up' | 'down' | 'flat'; label: string } {
  if (!series || series.length < 2) return { dir: 'flat', label: '. . .' };
  const first = Number(String(series[0].valueUsd).replace(/[^0-9.\-]/g, ''));
  const last = Number(String(series[series.length - 1].valueUsd).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return { dir: 'flat', label: '. . .' };
  const diff = last - first;
  const pct = (diff / first) * 100;
  const sign = diff >= 0 ? '+' : '';
  return {
    dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    label: `${sign}${pct.toFixed(2)}% . 7d`,
  };
}

function short(hash: string): string {
  if (!hash) return '';
  return hash.length > 10 ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : hash;
}

function parseUsd(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(String(s).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/* ============ icons ============ */

function TradeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 17l5-6 4 4 5-7 4 5M3 21h18" /></svg>;
}
function MoveIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 20l-4-4 4-4" /></svg>;
}
function AgentsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="9" r="3.5" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
}
function ReservesIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 8l7-4 7 4v9c0 1-1 2-2 2H7c-1 0-2-1-2-2V8z" /><path d="M9 14h6" /></svg>;
}
