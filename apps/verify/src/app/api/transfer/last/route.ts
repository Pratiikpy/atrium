import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { formatShares } from '@/lib/format-usd';

export const dynamic = 'force-dynamic';

const USDC_DECIMALS = 6;

export async function GET() {
  const wallet = process.env.DEMO_WALLET_ADDRESS ?? null;
  if (!wallet) return NextResponse.json(emptyResponse());
  try {
    const data = await gql<{
      crossChainCredits: Array<{
        id: string;
        amountWei: string;
        sourceChainSelector: string;
        destChainSelector: string;
        isSettled: boolean;
        isClaimedBack: boolean;
        createdAtBlock: string;
        settledAtBlock: string | null;
      }>;
    }>(
      `query Last($u: Bytes!) {
        crossChainCredits(first: 1, where: { user: $u }, orderBy: createdAtBlock, orderDirection: desc) {
          id amountWei sourceChainSelector destChainSelector isSettled isClaimedBack createdAtBlock settledAtBlock
        }
      }`,
      { u: wallet.toLowerCase() }
    );
    const c = data.crossChainCredits?.[0];
    if (!c) return NextResponse.json(emptyResponse());
    // Audit KK-11 fix: formatShares preserves precision past safe-int.
    const amount = formatShares(BigInt(c.amountWei), USDC_DECIMALS);
    // Audit U-22: pre-fix the four per-step `delta` fields were hardcoded
    // (`'0.0s'`, `'1.2s'`, `'3.4s'`, `'8.4s'`) and presented next to real
    // status badges from Scribe — every CCIP transfer rendered identical
    // step timings regardless of how long the message actually took.
    // CrossChainCredit doesn't expose per-step timestamps (only the source
    // block and the settled block), so the honest answer is null deltas.
    // We DO compute the total block-delta when settled — the only thing we
    // can measure without inventing data.
    const blocksElapsed =
      c.isSettled && c.settledAtBlock
        ? Number(BigInt(c.settledAtBlock) - BigInt(c.createdAtBlock))
        : null;
    return NextResponse.json({
      from: 'ARB',
      to: 'RHC',
      amount,
      asset: 'USDC',
      status: c.isSettled ? 'SETTLED' : c.isClaimedBack ? 'CLAIMED_BACK' : 'IN_TRANSIT',
      steps: [
        { label: 'Signature submitted', status: 'complete', delta: null },
        { label: 'Source commit · Aqueduct', status: 'complete', delta: null },
        {
          label: 'CCIP message in transit',
          status: c.isSettled ? 'complete' : 'in_progress',
          delta: null,
        },
        {
          label: 'Destination finalised',
          status: c.isSettled ? 'complete' : 'pending',
          delta: null,
        },
      ],
      // Honest measurement: blocks between source-commit and dest-settle.
      // null when the message hasn't settled yet.
      blocksElapsed,
      txHash: c.id,
      source: 'scribe' as const,
    });
  } catch {
    return NextResponse.json(emptyResponse());
  }
}

function emptyResponse() {
  return {
    from: 'ARB',
    to: 'RHC',
    amount: '0',
    asset: 'USDC',
    // Audit U-22: pre-fix status was 'SETTLED' — implying a completed
    // transfer even when no transfer exists. Now null so the timeline
    // shell renders neutral pending pills.
    status: null,
    steps: [
      { label: 'Signature submitted', status: 'pending', delta: null },
      { label: 'Source commit · Aqueduct', status: 'pending', delta: null },
      { label: 'CCIP message in transit', status: 'pending', delta: null },
      { label: 'Destination finalised', status: 'pending', delta: null },
    ],
    blocksElapsed: null,
    txHash: null,
    source: 'pending',
  };
}
