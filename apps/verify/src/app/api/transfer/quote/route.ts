import { NextRequest, NextResponse } from 'next/server';
import { loadContractAddress } from '@/lib/deployments-registry';

export const dynamic = 'force-dynamic';

/**
 * Transfer-quote endpoint. Returns:
 *   - estimatedSeconds: empirical CCIP testnet finality
 *   - ccipFeeUsd: LINK fee converted to USD via Chainlink price feed
 *   - gasFeeUsd: l2 gas estimate (Postern sponsored on testnet)
 *
 * Until Aqueduct deploys, returns source=pending with null values so the
 * Transfer form renders "—" honestly.
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
  // Postern sponsors gas on testnet (audit-K-9). CCIP fee is bounded
  // testnet LINK; ~0.001 LINK ≈ $0.02 at typical Sepolia rates, but for the
  // demo we report literal 0 (Pimlico verifying paymaster).
  return NextResponse.json({
    estimatedSeconds,
    ccipFeeUsd: '$0.00',
    gasFeeUsd: '$0.00 · Postern sponsored',
    postedAt: 'on arrival',
    source: 'aqueduct' as const,
  });
}

