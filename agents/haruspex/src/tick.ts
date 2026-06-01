/**
 * Haruspex tick, 7-day SMA crossover momentum agent (Phase 6).
 *
 * Long when price > SMA + 1σ. Close when price < SMA.
 */

import { createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
const SCRIBE_URL = process.env.SCRIBE_URL ?? '';
const AGENT_KEY = process.env.HARUSPEX_PRIVATE_KEY ?? '';
const ROUTER_ADDRESS = process.env.ATRIUM_ROUTER_ADDRESS ?? '';

interface PricePoint { timestamp: number; price: number }

async function fetchPriceSeries(instrument: string, days: number): Promise<PricePoint[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
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

export function computeSmaSignal(prices: number[], window: number): 'long' | 'close' | 'hold' {
  if (prices.length < window) return 'hold';
  const slice = prices.slice(-window);
  const sma = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((a, p) => a + (p - sma) ** 2, 0) / slice.length;
  const sigma = Math.sqrt(variance);
  const current = prices[prices.length - 1];
  if (current > sma + sigma) return 'long';
  if (current < sma) return 'close';
  return 'hold';
}

async function tick() {
  if (!AGENT_KEY || !ROUTER_ADDRESS || !SCRIBE_URL) {
    console.log('[haruspex] missing config, skipping tick');
    return;
  }

  const series = await fetchPriceSeries('ETH-USD', 7);
  if (series.length < 7) {
    console.log('[haruspex] insufficient price data');
    return;
  }

  const prices = series.map((p) => p.price);
  const signal = computeSmaSignal(prices, 168); // 7d of hourly candles

  console.log(`[haruspex] signal=${signal} latest=${prices[prices.length - 1]}`);

  const account = privateKeyToAccount(AGENT_KEY as `0x${string}`);
  const client = createWalletClient({ account, chain: arbitrumSepolia, transport: http(RPC_URL) });

  const routerAbi = parseAbi([
    'function openPositionViaAdapter(address adapter, bytes calldata data) external',
    'function closePositionViaAdapter(address adapter, bytes calldata data) external',
  ]);

  try {
    if (signal === 'long') {
      const data = `0x${Buffer.from(JSON.stringify({ instrument: 'ETH-USD', direction: 'long', sizePct: 10 })).toString('hex')}`;
      await client.writeContract({
        address: ROUTER_ADDRESS as `0x${string}`,
        abi: routerAbi,
        functionName: 'openPositionViaAdapter',
        args: [ROUTER_ADDRESS as `0x${string}`, data as `0x${string}`],
      });
      console.log('[haruspex] opened long');
    } else if (signal === 'close') {
      await client.writeContract({
        address: ROUTER_ADDRESS as `0x${string}`,
        abi: routerAbi,
        functionName: 'closePositionViaAdapter',
        args: [ROUTER_ADDRESS as `0x${string}`, '0x' as `0x${string}`],
      });
      console.log('[haruspex] closed position');
    }
  } catch (err: any) {
    console.error('[haruspex] tx reverted:', err.message ?? err);
  }
}

tick().catch(console.error);
