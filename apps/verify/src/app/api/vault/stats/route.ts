import { NextResponse } from 'next/server';
import { loadContractAddress } from '@/lib/deployments-registry';

export const dynamic = 'force-dynamic';

/**
 * Coffer (ERC-4626) stats. Reads totalAssets() + balanceOf(user) + convertToAssets(1share)
 * via viem. Honest pending state until Coffer is in the deployments registry.
 *
 * Wave-II refactor: registry-reading + zero-address-sentinel handling lives
 * in `lib/deployments-registry.ts` now (audit HH-2 tested).
 */
export async function GET(req?: Request) {
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  const cofferAddress = await loadContractAddress('coffer');
  if (!cofferAddress) {
    return NextResponse.json({ vaultTvlUsd: null, userSharesFormatted: null, sharePriceUsd: null, source: 'pending' });
  }
  try {
    // Audit U-8 fix: single viem import block. The previous version called
    // `await import('viem')` twice which paid per-request module-resolution
    // overhead. The display formatters now live in `lib/format-usd.ts` so
    // we only need createPublicClient/http/getContract here.
    const { createPublicClient, http, getContract } = await import('viem');
    const { arbitrumSepolia } = await import('viem/chains');
    const { formatUsd, formatShares, formatSharePrice } = await import('@/lib/format-usd');
    const client = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com'),
    });
    const coffer = getContract({ address: cofferAddress as `0x${string}`, abi: COFFER_ABI, client });
    // Audit S-1: USDC has 6 decimals; Coffer is an ERC-4626 over USDC so
    // share decimals = asset decimals = 6 (not 18). The constant + the
    // formatter helpers in `lib/format-usd.ts` lock this invariant —
    // see `format-usd.test.ts` for the regression coverage.
    const USDC_DECIMALS = 6;
    // viem generates strict types from the ABI: zero-arg functions take
    // no arg, single-arg functions take a [tuple]. Match the generated
    // shapes exactly or the next/tsc build fails (vi.mock hides this in tests).
    const totalAssets = (await coffer.read.totalAssets()) as bigint;
    const sharesUser = wallet
      ? ((await coffer.read.balanceOf([wallet as `0x${string}`])) as bigint)
      : 0n;
    const oneShareInAssets = (await coffer.read.convertToAssets([10n ** BigInt(USDC_DECIMALS)])) as bigint;
    return NextResponse.json({
      vaultTvlUsd: formatUsd(totalAssets, USDC_DECIMALS),
      userSharesFormatted: formatShares(sharesUser, USDC_DECIMALS),
      sharePriceUsd: formatSharePrice(oneShareInAssets, USDC_DECIMALS),
      source: 'coffer' as const,
    });
  } catch {
    return NextResponse.json({ vaultTvlUsd: null, userSharesFormatted: null, sharePriceUsd: null, source: 'pending' });
  }
}

const COFFER_ABI = [
  { type: 'function', name: 'totalAssets', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'convertToAssets', stateMutability: 'view', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const;
