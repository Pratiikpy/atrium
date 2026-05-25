import { NextResponse } from 'next/server';
import { tryGetPlinth } from '@/lib/portfolio-source';

export const dynamic = 'force-dynamic';

export async function GET(req?: Request) {
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  const plinth = await tryGetPlinth();
  if (!plinth || !wallet) {
    return NextResponse.json({
      marginHealthBps: null,
      liquidationBufferBps: null,
      collateralBars: [],
      source: 'pending',
    });
  }
  try {
    const [collateral, required] = await plinth.read.getAccount([wallet]);
    const ratio = required === 0n ? 10_000n : (collateral * 10_000n) / required;
    // Audit LL-8 fix: ratio is a BigInt; on tiny `required` values it can
    // exceed Number.MAX_SAFE_INTEGER and corrupt the marginHealthBps int
    // shipped to the UI. Clamp to a sane uint16-style range before Number cast.
    const ratioBpsClamped = ratio > 1_000_000n ? 1_000_000 : Number(ratio);
    const bufferBps = ratio > 10_000n
      ? Math.min(1_000_000, Number(ratio - 10_000n))
      : 0;
    // Audit LL-7 fix: same off-by-up-to-2× bug as JJ-2. Pre-fix:
    // `(collateral * 10_000n) / (required + 1n)` would compute
    // `collateral * 5000` when required=1 instead of `collateral * 10_000`.
    // Special-case zero, exact ratio otherwise.
    const collateralBarWidthBps = required === 0n
      ? 10_000
      : Math.min(10_000, Number((collateral * 10_000n) / required));
    return NextResponse.json({
      marginHealthBps: ratioBpsClamped,
      liquidationBufferBps: bufferBps,
      collateralBars: [{ label: 'USDC vault', widthBps: collateralBarWidthBps }],
      source: 'plinth' as const,
    });
  } catch {
    return NextResponse.json({
      marginHealthBps: null,
      liquidationBufferBps: null,
      collateralBars: [],
      source: 'pending',
    });
  }
}
