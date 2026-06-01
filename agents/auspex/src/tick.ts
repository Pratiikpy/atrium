/**
 * Auspex tick, basis-trade agent (Phase 6).
 *
 * Reads perp funding rate from Hyperliquid testnet, T-bill yield from
 * Aave-Horizon. Opens hedged pair when funding > yield + 200bps.
 */

import { createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
const AGENT_KEY = process.env.AUSPEX_PRIVATE_KEY ?? '';
const ROUTER_ADDRESS = process.env.ATRIUM_ROUTER_ADDRESS ?? '';
const ENTER_THRESHOLD_BPS = 200;

async function fetchFundingRate(): Promise<number> {
  try {
    const r = await fetch('https://api.hyperliquid-testnet.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    });
    if (!r.ok) return 0;
    const json = await r.json() as any;
    const ethCtx = json[1]?.find((a: any) => a.coin === 'ETH');
    return ethCtx ? Number(ethCtx.funding) * 10000 * 365 : 0; // annualized bps
  } catch {
    return 0;
  }
}

async function fetchTBillYield(): Promise<number> {
  // Aave-Horizon T-bill yield approximation from on-chain supply rate
  try {
    const r = await fetch('https://aave-api-v2.aave.com/data/rates-history?reserveId=0x' + '0'.repeat(40));
    if (!r.ok) return 400; // default 4% if unavailable
    const json = await r.json() as any;
    return json[0]?.liquidityRate_avg ? Number(json[0].liquidityRate_avg) * 10000 : 400;
  } catch {
    return 400;
  }
}

export function computeBasisSignal(fundingBps: number, yieldBps: number): 'enter' | 'close' | 'hold' {
  const spread = fundingBps - yieldBps;
  if (spread > ENTER_THRESHOLD_BPS) return 'enter';
  if (spread < 0) return 'close';
  return 'hold';
}

async function tick() {
  if (!AGENT_KEY || !ROUTER_ADDRESS) {
    console.log('[auspex] missing config, skipping tick');
    return;
  }

  const [funding, tbill] = await Promise.all([fetchFundingRate(), fetchTBillYield()]);
  const signal = computeBasisSignal(funding, tbill);

  console.log(`[auspex] funding=${funding}bps tbill=${tbill}bps signal=${signal}`);

  const account = privateKeyToAccount(AGENT_KEY as `0x${string}`);
  const client = createWalletClient({ account, chain: arbitrumSepolia, transport: http(RPC_URL) });

  const routerAbi = parseAbi([
    'function openPositionViaAdapter(address adapter, bytes calldata data) external',
    'function closePositionViaAdapter(address adapter, bytes calldata data) external',
  ]);

  try {
    if (signal === 'enter') {
      const data = `0x${Buffer.from(JSON.stringify({ instrument: 'ETH-USD', direction: 'basis', sizePct: 10 })).toString('hex')}`;
      await client.writeContract({
        address: ROUTER_ADDRESS as `0x${string}`,
        abi: routerAbi,
        functionName: 'openPositionViaAdapter',
        args: [ROUTER_ADDRESS as `0x${string}`, data as `0x${string}`],
      });
      console.log('[auspex] opened basis trade');
    } else if (signal === 'close') {
      await client.writeContract({
        address: ROUTER_ADDRESS as `0x${string}`,
        abi: routerAbi,
        functionName: 'closePositionViaAdapter',
        args: [ROUTER_ADDRESS as `0x${string}`, '0x' as `0x${string}`],
      });
      console.log('[auspex] closed basis trade');
    }
  } catch (err: any) {
    console.error('[auspex] tx reverted:', err.message ?? err);
  }
}

tick().catch(console.error);
