import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { formatShares } from '@/lib/format-usd';

export const dynamic = 'force-dynamic';

const USDC_DECIMALS = 6;

export async function GET(req?: Request) {
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  if (!wallet) return NextResponse.json({ transfers: [], source: 'pending' });
  try {
    const data = await gql<{
      crossChainCredits: Array<{
        id: string; amountWei: string; isSettled: boolean; isClaimedBack: boolean; createdAtBlock: string;
      }>;
    }>(
      `query Recent($u: Bytes!) {
        crossChainCredits(first: 20, where: { user: $u }, orderBy: createdAtBlock, orderDirection: desc) {
          id amountWei isSettled isClaimedBack createdAtBlock
        }
      }`,
      { u: wallet.toLowerCase() }
    );
    // Audit NN-7 fix: precision loss past safe-int via Number(BigInt(.))/1e6.
    // formatShares uses viem's formatUnits which preserves the full precision.
    // Audit U-24 fix: per-row `duration: '8.4s'` and `timestamp: 'recent'`
    // were hardcoded — every transfer row shipped identical fake values
    // even when scribe returned 20 distinct credits with different block
    // numbers. CrossChainCredit doesn't expose per-row timestamps (only
    // createdAtBlock), so the honest answer is null duration + the real
    // block number for timestamp.
    const transfers = (data.crossChainCredits ?? []).map((c) => ({
      id: c.id,
      amount: formatShares(BigInt(c.amountWei), USDC_DECIMALS),
      asset: 'USDC',
      fromChain: 'arb-sepolia',
      toChain: 'rh-chain',
      duration: null as string | null,
      status: (c.isSettled
        ? 'SETTLED'
        : c.isClaimedBack
          ? 'CLAIMED_BACK'
          : 'IN_TRANSIT') as 'SETTLED' | 'IN_TRANSIT' | 'CLAIMED_BACK',
      timestamp: `block ${c.createdAtBlock}`,
    }));
    return NextResponse.json({ transfers, source: 'scribe' as const });
  } catch {
    return NextResponse.json({ transfers: [], source: 'pending' });
  }
}
