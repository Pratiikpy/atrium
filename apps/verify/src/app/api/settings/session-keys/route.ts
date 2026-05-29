import { NextRequest, NextResponse } from 'next/server';
import { tryGetSessionKeys } from '@/lib/postern-source';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/session-keys?wallet=0x...
 *
 * Lists a wallet's active ERC-7715 session keys + expiries from the deployed
 * PosternKeyRegistry. Returns an honest empty `source: 'pending'` when the
 * registry is not deployed, no wallet is given, or the read reverts - never a
 * fabricated key.
 *
 * This route previously did not exist: the EmergencyStopCard and the mobile
 * kill switch fetched it and silently treated the 404 as "0 session keys".
 * Now the count is real.
 */
export async function GET(req: NextRequest) {
  const walletParam = req.nextUrl.searchParams.get('wallet');
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;

  const { keys, source } = await tryGetSessionKeys(wallet);
  return NextResponse.json({
    keys,
    count: keys.length,
    source,
  });
}
