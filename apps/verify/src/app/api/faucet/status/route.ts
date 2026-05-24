import { NextResponse } from 'next/server';
import { loadContractAddress } from '@/lib/deployments-registry';

export const dynamic = 'force-dynamic';

/**
 * Faucet drop schedule for first-visit accounts.
 *
 * The amounts match the prototype's closing-CTA promise on the landing page
 * ($10k USDC + $5k rAAPL etc) and are not yet honest — the faucet ERC20 mint
 * contracts (rUSDC, rAAPL, rWETH) are deployed alongside Coffer in Month 1
 * Week 2 per the deployment plan. Until then `available` is false and the
 * onboarding step shows a named pending state instead of a fake claim button.
 *
 * The drop list itself is a fixed contract — once the faucet is live, this
 * route returns `available: true` and the same drop schedule, plus the
 * per-asset contract addresses so the client can verify on Arbiscan.
 */
export async function GET() {
  // The faucet's "ready" state is gated on Coffer being deployed — once the
  // vault accepts USDC, the faucet can mint+approve+deposit in one tx.
  // Until then we can't honestly say a faucet is live.
  const cofferAddress = await loadContractAddress('coffer');

  const drops = [
    { token: 'USDC', amount: 10000, chain: 'arb-sepolia' as const },
    { token: 'USDC', amount: 5000, chain: 'rh-chain' as const },
    { token: 'rAAPL', amount: 25, chain: 'rh-chain' as const },
    { token: 'WETH', amount: 3, chain: 'arb-sepolia' as const },
  ];

  if (!cofferAddress) {
    return NextResponse.json({
      available: false,
      reason: 'Faucet contract deploys with Coffer (Month 1 W2)',
      drops,
      source: 'pending' as const,
    });
  }

  // Coffer is deployed but the faucet route specifically requires a per-asset
  // faucet contract that has not been wired yet — keep honest until Curator
  // whitelists the faucet adapter.
  return NextResponse.json({
    available: false,
    reason: 'Faucet adapter pending Curator whitelist',
    drops,
    source: 'pending' as const,
  });
}
