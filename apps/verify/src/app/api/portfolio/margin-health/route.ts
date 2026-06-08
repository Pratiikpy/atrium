import { NextResponse } from 'next/server';
import { tryGetPlinth } from '@/lib/portfolio-source';
import { requireWalletMatch } from '@/lib/auth-session';
import { noCacheHeaders } from '@/lib/no-cache-headers';

export const dynamic = 'force-dynamic';

export async function GET(req?: Request) {
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  // Phase 2c: lock to authenticated session
  if (req && wallet) {
    const denied = await requireWalletMatch(req, wallet);
    if (denied) return denied;
  }
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
    // No open positions (required margin 0) => no liquidation risk at all, so
    // there is no meaningful buffer to show. Return null; the card renders that
    // as "-". Pre-fix this fell to the `: 0` branch (ratio is exactly 10_000n
    // when required=0, which is NOT > 10_000n), so a wallet with zero positions
    // showed "LIQUIDATION BUFFER 0.0%" right next to "Vigil triggers liquidation
    // when this hits zero" - i.e. it read as "you are being liquidated" in the
    // single safest possible state. The `: 0` else now only fires when there IS
    // a position whose buffer has genuinely eroded to zero. Found via real-wallet
    // post-close QA (qa-evidence/rabby/wallet-flow/21-portfolio-postclose.png).
    const bufferBps = required === 0n
      ? null
      : ratio > 10_000n
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
    }, { headers: noCacheHeaders });
  } catch {
    return NextResponse.json({
      marginHealthBps: null,
      liquidationBufferBps: null,
      collateralBars: [],
      source: 'pending',
    });
  }
}
