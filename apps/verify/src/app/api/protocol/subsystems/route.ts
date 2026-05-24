import { NextResponse } from 'next/server';
import { listLiveContracts } from '@/lib/deployments-registry';

export const dynamic = 'force-dynamic';

/**
 * Returns the list of subsystem slugs that have a real (non-zero) deployment
 * address recorded in `deployments/arbitrum_sepolia.json`. Read by the
 * landing-page Subsystems section so the green dots reflect on-chain truth.
 *
 * Wave-HH refactor: registry-reading logic now lives in
 * `lib/deployments-registry.ts` (audit-tested). This route is now a thin
 * wrapper.
 */
export async function GET() {
  const live = await listLiveContracts();
  if (live.length === 0) {
    return NextResponse.json({ live: [], source: 'pending' as const });
  }
  return NextResponse.json({
    live: live.map((c) => c.slug),
    source: 'deployments' as const,
  });
}
