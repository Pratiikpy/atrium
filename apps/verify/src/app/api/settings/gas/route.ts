import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const wallet = process.env.DEMO_WALLET_ADDRESS ?? null;
  // Iteration 37 audit fix: same partial-coverage pattern as iter 36 and
  // agents/summary above. Audit TTT-4 fixed the client-side catch in
  // gas-sponsorship.tsx (→ sponsored: null) but the SERVER returned 0 in
  // both paths. JS nullish coalescing (`data?.sponsored ?? '—'`) returns
  // `0` not `'—'` because 0 is non-nullish — so the UI rendered "0 / 10
  // sponsored" as if measured, masking the unwired-paymaster reality.
  //
  // Wave-N+1: query Pimlico paymaster for this wallet's monthly usage.
  // Until then, null = "not yet wired" honestly; UI falls through to '—'.
  if (!wallet) return NextResponse.json({ sponsored: null, cap: 10, active: false, source: 'pending' });
  return NextResponse.json({ sponsored: null, cap: 10, active: false, source: 'pending' });
}
