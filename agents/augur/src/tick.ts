/**
 * Augur tick — mean-reversion agent (Phase 6).
 *
 * Invoked by GHA cron. Reads 24h price series, computes z-score vs 30d mean.
 * If |z| > 2: open opposite-direction position at 10% of available margin.
 * Close when |z| < 0.5.
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
const SCRIBE_URL = process.env.SCRIBE_URL ?? '';
const AGENT_KEY = process.env.AUGUR_PRIVATE_KEY ?? '';
const ROUTER_ADDRESS = process.env.ATRIUM_ROUTER_ADDRESS ?? '';

interface PricePoint { timestamp: number; price: number }

async function fetchPriceSeries(instrument: string, hours: number): Promise<PricePoint[]> {
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  const query = `{ priceCandles(where: { instrumentId: "${instrument}", timestamp_gte: "${since}" }, first: 1000, orderBy: timestamp) { timestamp closePrice } }`;
  const r = await fetch(SCRIBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) return [];
  const json = await r.json() as any;
  return (json.data?.priceCandles ?? []).map((c: any) => ({
    timestamp: Number(c.timestamp),
    price: Number(c.closePrice) / 1e8,
  }));
}

function computeZScore(prices: number[], window: number): number {
  if (prices.length < window) return 0;
  const slice = prices.slice(-window);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((a, p) => a + (p - mean) ** 2, 0) / slice.length;
  const sigma = Math.sqrt(variance);
  if (sigma === 0) return 0;
  return (prices[prices.length - 1] - mean) / sigma;
}

async function tick() {
  if (!AGENT_KEY || !ROUTER_ADDRESS || !SCRIBE_URL) {
    console.log('[augur] missing config, skipping tick');
    return;
  }

  const series = await fetchPriceSeries('ETH-USD', 24 * 30); // 30d
  if (series.length < 30) {
    console.log('[augur] insufficient price data');
    return;
  }

  const prices = series.map((p) => p.price);
  const z = computeZScore(prices, 720); // ~30d of hourly candles

  console.log(`[augur] z-score=${z.toFixed(3)} latest=${prices[prices.length - 1]}`);

  const account = privateKeyToAccount(AGENT_KEY as `0x${string}`);
  const client = createWalletClient({ account, chain: arbitrumSepolia, transport: http(RPC_URL) });

  const routerAbi = parseAbi([
    'function openPositionViaAdapter(address adapter, bytes calldata data) external',
    'function closePositionViaAdapter(address adapter, bytes calldata data) external',
  ]);

  try {
    if (Math.abs(z) > 2) {
      const direction = z > 2 ? 'short' : 'long';
      console.log(`[augur] signal: open ${direction} (z=${z.toFixed(3)})`);
      // Encode position data — adapter-specific, placeholder encoding
      const data = `0x${Buffer.from(JSON.stringify({ instrument: 'ETH-USD', direction, sizePct: 10 })).toString('hex')}`;
      await client.writeContract({
        address: ROUTER_ADDRESS as `0x${string}`,
        abi: routerAbi,
        functionName: 'openPositionViaAdapter',
        args: [ROUTER_ADDRESS as `0x${string}`, data as `0x${string}`],
      });
      console.log(`[augur] opened ${direction} position`);
    } else if (Math.abs(z) < 0.5) {
      console.log('[augur] signal: close (z near mean)');
      await client.writeContract({
        address: ROUTER_ADDRESS as `0x${string}`,
        abi: routerAbi,
        functionName: 'closePositionViaAdapter',
        args: [ROUTER_ADDRESS as `0x${string}`, '0x' as `0x${string}`],
      });
      console.log('[augur] closed position');
    } else {
      console.log('[augur] hold');
    }
  } catch (err: any) {
    console.error('[augur] tx reverted (mandate revoked or paused?):', err.message ?? err);
  }
}

tick().catch(console.error);

export { computeZScore, fetchPriceSeries };
