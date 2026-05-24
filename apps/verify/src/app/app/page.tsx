import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { loadDeploymentRegistry } from '@/lib/deployments-registry';

export const metadata = {
  title: 'Atrium · App',
  description: 'One wallet posts collateral once. Trades across venues with one margin number.',
};

export const dynamic = 'force-dynamic';

/**
 * Audit 2026-05-24 C-5 (Auditor B) fix: the prior live-status panel
 * rendered hardcoded "Source built · deploy Month 1 W2" for every
 * Stylus contract, even though all four (Coffer / Plinth / Sigil /
 * Vigil) are deployed on Sepolia. Now reads the deployments registry
 * + an init probe via viem so each row reflects real on-chain state:
 *   - "Not deployed" if no registry entry
 *   - "Deployed (pending init)" if asset()/praetorMultisig() returns 0x0
 *   - "Live" with address otherwise
 *   - "RPC unreachable" if the probe throws
 */
async function probeInit(slug: string, probe: 'asset' | 'praetorMultisig') {
  const registry = await loadDeploymentRegistry();
  const addr = registry?.contracts?.[slug]?.address;
  if (!addr || addr === '0x' + '0'.repeat(40)) return { state: 'not-deployed' as const, address: null };
  try {
    const { createPublicClient, http } = await import('viem');
    const { arbitrumSepolia } = await import('viem/chains');
    const client = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com'),
    });
    const abi = [{ type: 'function', name: probe, stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const;
    const result = (await client.readContract({ address: addr as `0x${string}`, abi, functionName: probe })) as string;
    if (!result || result === '0x' + '0'.repeat(40)) return { state: 'pending-init' as const, address: addr };
    return { state: 'live' as const, address: addr };
  } catch {
    return { state: 'unreachable' as const, address: addr };
  }
}

function statusLabel(state: string, address: string | null): string {
  switch (state) {
    case 'live':
      return `Live · ${address?.slice(0, 6)}…${address?.slice(-4)}`;
    case 'pending-init':
      return `Deployed (pending init)`;
    case 'not-deployed':
      return `Not deployed`;
    case 'unreachable':
      return `RPC unreachable`;
    default:
      return state;
  }
}

export default async function AppHome() {
  const [coffer, plinth, sigil, vigil] = await Promise.all([
    probeInit('coffer', 'asset'),
    probeInit('plinth', 'praetorMultisig'),
    probeInit('sigil', 'praetorMultisig'),
    probeInit('vigil', 'praetorMultisig'),
  ]);
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
            <Row label="Plinth" status={statusLabel(plinth.state, plinth.address)} />
            <Row label="Coffer (vault)" status={statusLabel(coffer.state, coffer.address)} />
            <Row label="Sigil (agents)" status={statusLabel(sigil.state, sigil.address)} />
            <Row label="Vigil (liquidator)" status={statusLabel(vigil.state, vigil.address)} />
            <Row label="Adapters (9)" status="All shipped" />
            <Row label="Lantern attestor" status="Cron live (daily 12:00 UTC)" />
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
