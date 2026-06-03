import { AppShell } from '@/components/app-shell';
import { TradeView } from '@/components/trade/trade-view';
import { TradeMobile } from '@/components/mobile/panels/trade-mobile';
import { TestnetPill } from '@/components/ui/testnet-pill';

export const metadata = {
  title: 'Trade',
  description: 'Execute across every Atrium-registered Portico adapter.',
};

// Audit U-20: OrderForm now calls wagmi's useAccount + useWriteContract
// from useOpenPosition. Those hooks need WagmiProvider in context, so
// force-dynamic prevents prerender from throwing. Matches /app/vault and
// /app/agents.
export const dynamic = 'force-dynamic';

export default function TradePage() {
  return (
    <AppShell
      active="/app/trade"
      breadcrumb={[
        { label: 'Trade' },
        { label: 'Venue execution · Portico' },
      ]}
      mobile={<TradeMobile />}
      desktop={
      <div className="hidden md:block">
      <header className="flex items-start justify-between">
        <div>
          <p className="eyebrow">Trade · Portico</p>
          <h1 className="mt-1 font-display text-4xl italic tracking-tight text-ink">
            Execute across every Atrium-registered venue
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted">
            Use signature stamp, adjust, or create a new authorised Portico adapter.
          </p>
        </div>
        <TestnetPill />
      </header>

      <TradeView />
      </div>
      }
    />
  );
}
