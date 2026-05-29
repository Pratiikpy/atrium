'use client';

import { useQuery } from '@tanstack/react-query';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';
import { SUBSYSTEMS } from '@/lib/atrium/copy';

interface MarginHealth {
  marginHealthBps: number | null;
  liquidationBufferBps: number | null;
  collateralBars: { label: string; widthBps: number }[];
  source: 'plinth' | 'pending';
}

async function fetchHealth(wallet: string | null): Promise<MarginHealth> {
  const r = await fetch(walletQuery('/api/portfolio/margin-health', wallet));
  if (!r.ok) throw new Error(`health_${r.status}`);
  return r.json();
}

export function MarginEngineCard() {
  const wallet = useScopedWallet();
  const { data, isLoading, error } = useQuery({
    queryKey: ['margin-health', wallet],
    queryFn: () => fetchHealth(wallet),
    refetchInterval: 30_000,
  });

  return (
    <div className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="eyebrow">{SUBSYSTEMS.plinth.plain} · {SUBSYSTEMS.plinth.brand}</p>
          <p
            className="mt-1 font-sans font-medium tracking-[-0.02em] text-ink"
            style={{ fontSize: 22 }}
          >
            Account health
          </p>
        </div>
        <span className="text-xs text-muted">SPAN cross-product</span>
      </header>

      {/* Plain-English "why is my margin lower?" - the engine's whole point. */}
      <p className="mt-2 text-[12px] leading-snug text-ink-soft">
        Required margin drops when your positions offset. Atrium nets correlated risk across venues,
        so the same collateral backs more.
      </p>

      {isLoading ? (
        <div className="mt-5 space-y-2">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="skeleton h-3 w-2/3 rounded" />
        </div>
      ) : error ? (
        // Audit TTT-3 fix: pre-fix the error path fell through to
        // `defaultEmptyBars` which rendered "USDC vault 0.0% / HIP-3 perp
        // 0.0% / T-bill 0.0%" as if real — making a user with actual
        // collateral think their margin account was empty. Error must be
        // explicit; null bars + "pending" sub copy keeps the UI shape
        // without lying about the underlying state.
        <div className="mt-5 rounded-md border border-testnet/30 bg-testnet/5 p-4 text-sm">
          <p className="font-medium text-testnet">Could not load margin health</p>
          <p className="mt-1 text-ink-soft">
            Plinth read failed. The previous breakdown is not necessarily current; reload
            after the next refetch (30s) for fresh state.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            {(data?.collateralBars && data.collateralBars.length > 0
              ? data.collateralBars
              : defaultPendingBars
            ).map((bar) => (
              <div key={bar.label}>
                <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted">
                  <span>{bar.label}</span>
                  <span className="font-mono">
                    {data?.source === 'plinth'
                      ? `${(bar.widthBps / 100).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-divider-soft">
                  <div
                    className="h-full bg-ink transition-all"
                    style={{
                      width: `${data?.source === 'plinth' ? Math.max(0, Math.min(100, bar.widthBps / 100)) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-md bg-parchment-soft/60 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] uppercase tracking-wider text-muted">Liquidation buffer</p>
              <p className="font-mono text-2xl text-ink">
                {data?.liquidationBufferBps == null
                  ? '—'
                  : `${(data.liquidationBufferBps / 100).toFixed(1)}%`}
              </p>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Buffer between current collateral and the liquidation threshold. Vigil triggers
              partial liquidation when this hits zero.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// Audit TTT-3 fix: renamed `defaultEmptyBars` → `defaultPendingBars` and
// the consumer now suppresses the percentage display (renders "—") when
// the source isn't 'plinth'. The label set remains so the UI shape stays
// stable, but no fake-zero percentages get presented as real readings.
const defaultPendingBars = [
  { label: 'USDC vault', widthBps: 0 },
  { label: 'HIP-3 perp collateral', widthBps: 0 },
  { label: 'T-bill cash-equiv', widthBps: 0 },
];
