import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req?: Request) {
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  // Iteration 37 audit fix: same partial-coverage pattern as iter 36 and
  // agents/summary above. Audit TTT-4 fixed the client-side catch in
  // gas-sponsorship.tsx (→ sponsored: null) but the SERVER returned 0 in
  // both paths. JS nullish coalescing (`data?.sponsored ?? '-'`) returns
  // `0` not `'-'` because 0 is non-nullish, so the UI rendered "0 / 10
  // sponsored" as if measured, masking the unwired-paymaster reality.
  //
  // Wave-N+1: query Pimlico paymaster for this wallet's monthly usage.
  // Until then, null = "not yet wired" honestly; UI falls through to '-'.
  if (!wallet) return NextResponse.json({ sponsored: null, cap: 10, active: false, source: 'pending' });
  return NextResponse.json({ sponsored: null, cap: 10, active: false, source: 'pending' });
}
