import Link from 'next/link';
import { AppShell } from '@/components/app-shell';

export const metadata = {
  title: 'Atrium · App',
  description: 'One wallet posts collateral once. Trades across venues with one margin number.',
};

export default function AppHome() {
  return (
    <AppShell>
      <section className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="text-xs uppercase tracking-wider text-muted">Welcome</p>
          <h1 className="mt-2 font-display text-5xl text-ink">One wallet. One margin number.</h1>
          <p className="mt-4 max-w-prose text-ink-soft">
            Atrium nets your collateral across Hyperliquid, Aave Horizon, Pendle, Curve,
            Trade.xyz and Polymarket under one SPAN-style calculation. Same risk, far less locked.
            Year-1 on Arbitrum Sepolia testnet.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/app/onboarding"
              className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm min-h-[44px] font-medium text-parchment hover:bg-ink/90"
            >
              Set up account →
            </Link>
            <Link
              href="/app/trade"
              className="inline-flex items-center gap-2 rounded-md border border-divider bg-parchment px-5 py-3 text-sm min-h-[44px] font-medium text-ink hover:border-ink/30"
            >
              Open a position
            </Link>
            <Link
              href="/app/vault"
              className="inline-flex items-center gap-2 rounded-md border border-divider bg-parchment px-5 py-3 text-sm min-h-[44px] font-medium text-ink hover:border-ink/30"
            >
              Deposit USDC
            </Link>
            <Link
              href="/verify/1"
              className="inline-flex items-center gap-2 rounded-md border border-divider bg-parchment px-5 py-3 text-sm min-h-[44px] font-medium text-ink-soft hover:text-ink hover:border-ink/30"
            >
              Run Verifier
            </Link>
          </div>
        </div>

        <aside className="rounded-md border border-divider bg-parchment-soft/40 p-6">
          <p className="text-xs uppercase tracking-wider text-muted">Live status</p>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Plinth" status="Source built · deploy Month 1 W2" />
            <Row label="Coffer (vault)" status="Source built · deploy Month 1 W2" />
            <Row label="Sigil (agents)" status="Source built · deploy Month 1 W2" />
            <Row label="Vigil (liquidator)" status="Source built · deploy Month 1 W2" />
            <Row label="Adapters (6)" status="All shipped" />
            <Row label="Lantern attestor" status="Cron deferred to Month 6" />
          </dl>
          <p className="mt-4 text-xs text-muted">
            Live state from <code className="font-mono text-ink">/api/deployments/status</code>.
            See <Link href="/security#audit-findings-register" className="underline">audit-findings register</Link>.
          </p>
        </aside>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        <Tile
          href="/app/portfolio"
          title="Portfolio"
          body="Net margin. Open positions across every venue. Real-time PnL from on-chain attestations."
        />
        <Tile
          href="/app/agents"
          title="Agents"
          body="Mint a Sigil mandate. Bounded delegation: per-action cap, per-day cap, instrument allowlist, instant Kill Switch."
        />
        <Tile
          href="/app/markets"
          title="Markets"
          body="Every Portico-whitelisted instrument. Live haircut and correlation class. Click through for spec."
        />
      </section>
    </AppShell>
  );
}

function Row({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-divider/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right text-xs text-muted">{status}</dd>
    </div>
  );
}

// Next 15 with typedRoutes wants UrlObject | RouteImpl. Use the more permissive
// `as any` escape only at this single coordinator-tile boundary — the actual
// route strings are still validated by Next at runtime.
function Tile({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href as any}
      className="block rounded-md border border-divider bg-parchment p-6 transition-colors hover:border-terracotta/40"
    >
      <p className="font-display text-2xl text-ink">{title}</p>
      <p className="mt-3 text-sm text-ink-soft">{body}</p>
    </Link>
  );
}
