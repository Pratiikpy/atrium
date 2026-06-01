import { NextRequest, NextResponse } from 'next/server';
import { loadContractAddress } from '@/lib/deployments-registry';
import { noCacheHeaders } from '@/lib/no-cache-headers';

export const dynamic = 'force-dynamic';

/**
 * Transfer-quote endpoint. Returns:
 *   - estimatedSeconds: empirical CCIP testnet finality
 *   - ccipFeeUsd: LINK fee converted to USD via Chainlink price feed
 *   - gasFeeUsd: l2 gas estimate (Postern sponsored on testnet)
 *
 * Until Aqueduct deploys, returns source=pending with null values so the
 * Transfer form renders "-" honestly.
 */
export async function GET(req: NextRequest) {
  const amountStr = req.nextUrl.searchParams.get('amount') ?? '0';
  const from = req.nextUrl.searchParams.get('from') ?? 'arb-sepolia';
  const to = req.nextUrl.searchParams.get('to') ?? 'rh-chain';
  // Audit JJ-4 refactor: migrate to the shared registry helper.
  const aqueductAddress = await loadContractAddress('aqueduct');

  if (!aqueductAddress || from === to) {
    return NextResponse.json({
      estimatedSeconds: null,
      ccipFeeUsd: null,
      gasFeeUsd: null,
      postedAt: 'on arrival',
      source: 'pending' as const,
      detail: from === to ? 'from == to' : 'aqueduct not deployed',
    });
  }
  const amount = Math.max(0, parseFloat(amountStr) || 0);
  // Empirical Arb Sepolia → other-Sepolia CCIP message finality is 7-12s.
  // We use a deterministic 8.4s estimate scaled gently with size.
  const estimatedSeconds = 8.4 + Math.min(2, amount / 100_000);
  // Honesty fix (2026-05-29 audit): these are ESTIMATES, not a live CCIP
  // quote. The previous response labelled them source:'aqueduct' which
  // implied they came from the deployed CCIP router via IRouterClient.getFee
  //, they did not; the seconds + fees are computed here. A real live quote
  // needs Aqueduct to expose a getFee passthrough (tracked in human_left.md
  // `aqueduct-live-quote`). Until then we return source:'estimate' + a note
  // so the Transfer form can caption it truthfully and never present a
  // fabricated figure as an on-chain quote. Testnet CCIP fees are genuinely
  // ~0 (LINK faucet) and L2 gas is Postern-sponsored, so the values are
  // honest estimates, just not a live read.
  return NextResponse.json({
    estimatedSeconds,
    ccipFeeUsd: '$0.00',
    gasFeeUsd: '$0.00 · Postern sponsored',
    postedAt: 'on arrival',
    source: 'estimate' as const,
    isLiveQuote: false,
    note: 'Testnet estimate, not a live CCIP router quote.',
  }, { headers: noCacheHeaders });
}

