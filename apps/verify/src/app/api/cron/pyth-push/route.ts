import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

/**
 * Pyth "marks keeper" cron.
 *
 * WHY: Plinth's dual-oracle reader requires a Pyth USDC/USD price no older
 * than 60s. Pyth on Arbitrum Sepolia is PULL-based (nobody keeps it fresh),
 * so a trade's margin check reverts ERR_ORACLE_STALE unless a fresh update was
 * pushed in the last 60s. This route pulls a signed update from Hermes and
 * pushes it on-chain. A Vercel cron (every minute, see vercel.json) keeps the
 * Pyth leg inside the window so Aave-Horizon opens succeed continuously.
 * Mirrors scripts/pyth-push-usdc.sh, the manual per-trade equivalent.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PYTH = '0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF' as const;
const FEED = '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a';
const HERMES = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${FEED}&encoding=hex`;
const PYTH_ABI = parseAbi([
  'function getUpdateFee(bytes[] updateData) view returns (uint256)',
  'function updatePriceFeeds(bytes[] updateData) payable',
]);

export async function GET(req: NextRequest) {
  // Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to cron invocations.
  // Reject anything else so the endpoint can't be spammed publicly (each call
  // spends testnet ETH on a real on-chain tx).
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rawKey = process.env.PYTH_KEEPER_KEY;
  const rpc = process.env.ARBITRUM_SEPOLIA_RPC;
  if (!rawKey || !rpc) {
    return NextResponse.json(
      { ok: false, error: 'missing PYTH_KEEPER_KEY or ARBITRUM_SEPOLIA_RPC' },
      { status: 500 },
    );
  }

  try {
    // 1. Pull the latest signed VAA from Hermes.
    const r = await fetch(HERMES, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`hermes_${r.status}`);
    const j = (await r.json()) as { binary?: { data?: string[] } };
    const hex = j.binary?.data?.[0];
    if (!hex || hex.length < 100) throw new Error('hermes_empty_blob');
    const blob = `0x${hex}` as `0x${string}`;

    // 2. Push on-chain (fee + updatePriceFeeds).
    const key = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
    const account = privateKeyToAccount(key);
    const pub = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
    const wallet = createWalletClient({ account, chain: arbitrumSepolia, transport: http(rpc) });
    const fee = await pub.readContract({
      address: PYTH,
      abi: PYTH_ABI,
      functionName: 'getUpdateFee',
      args: [[blob]],
    });
    const tx = await wallet.writeContract({
      address: PYTH,
      abi: PYTH_ABI,
      functionName: 'updatePriceFeeds',
      args: [[blob]],
      value: fee,
    });
    return NextResponse.json({ ok: true, tx, feeWei: fee.toString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    );
  }
}
