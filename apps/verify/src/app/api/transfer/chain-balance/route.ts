import { NextRequest, NextResponse } from 'next/server';
import { ARB_SEPOLIA_USDC } from '@/lib/testnet-tokens';

export const dynamic = 'force-dynamic';

/**
 * Per-chain token balance for the Transfer form's "From"/"To" pickers.
 * Reads via viem from the configured RPC. Returns honest pending state
 * if no wallet address is configured.
 */
export async function GET(req: NextRequest) {
  // Audit U-9 fix: `req.nextUrl` is a NextRequest-only extension; tests that
  // construct a plain `new Request(url)` get undefined here. `new URL(req.url)`
  // works against both Request and NextRequest, so the route stays testable
  // without a Next.js runtime polyfill.
  const params = new URL(req.url).searchParams;
  const chain = params.get('chain') ?? 'arb-sepolia';
  const token = params.get('token') ?? 'USDC';
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = params.get('wallet');
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  if (!wallet) {
    return NextResponse.json({ tokenSymbol: token, balanceFormatted: null, source: 'pending' });
  }
  // Audit U-10 fix: previously the TOKEN_BY_CHAIN/RPC_BY_CHAIN maps were
  // module-scope constants, so `process.env.*` was captured once at import
  // time. That made the route untestable (tests can't mutate env after the
  // module is cached) and meant operators had to restart the process to
  // pick up new addresses. Resolving per-request is cheap (a few env reads)
  // and lets the address-invalid path actually fire under test.
  const tokenAddress = resolveTokenAddress(chain, token);
  const rpcUrl = resolveRpcUrl(chain);
  if (!tokenAddress || !rpcUrl) {
    return NextResponse.json({ tokenSymbol: token, balanceFormatted: null, source: 'pending' });
  }
  // Audit R-8 fix: distinguish "address is invalid" (operator misconfig — 500
  // with logging so the bug surfaces) from "RPC is down or contract is not
  // deployed" (genuinely pending, fall through to the pending response).
  //
  // getAddress() throws on bad checksums or non-hex strings. Those are
  // misconfiguration errors and need to be loud; readContract throws on
  // RPC failures and those are expected as long as contracts aren't yet
  // deployed.
  const { createPublicClient, http, erc20Abi, formatUnits, getAddress } = await import('viem');
  let tokenAddrChecksummed: `0x${string}`;
  let walletChecksummed: `0x${string}`;
  try {
    tokenAddrChecksummed = getAddress(tokenAddress);
    walletChecksummed = getAddress(wallet);
    // Audit R-8 strict-checksum layer: viem's getAddress() silently fixes
    // mismatched checksums instead of throwing. For operator-config inputs
    // we want loud failure on mixed-case mismatch (EIP-55 convention is that
    // all-lowercase or all-uppercase = "no checksum claimed", which is fine).
    assertChecksumMatchesIfMixed(tokenAddress, tokenAddrChecksummed);
    assertChecksumMatchesIfMixed(wallet, walletChecksummed);
  } catch (err) {
    console.error(
      `[chain-balance] invalid address config (chain=${chain}, token=${token}): ${(err as Error).message}`,
    );
    return NextResponse.json(
      { error: 'address_invalid', detail: `Invalid token or wallet address for ${chain}.${token}` },
      { status: 500 },
    );
  }
  try {
    const client = createPublicClient({ transport: http(rpcUrl) });
    const [raw, decimals] = await Promise.all([
      client.readContract({ address: tokenAddrChecksummed, abi: erc20Abi, functionName: 'balanceOf', args: [walletChecksummed] }) as Promise<bigint>,
      client.readContract({ address: tokenAddrChecksummed, abi: erc20Abi, functionName: 'decimals', args: [] }) as Promise<number>,
    ]);
    const formatted = parseFloat(formatUnits(raw, decimals)).toLocaleString('en-US');
    return NextResponse.json({ tokenSymbol: token, balanceFormatted: formatted, source: 'rpc' as const });
  } catch {
    return NextResponse.json({ tokenSymbol: token, balanceFormatted: null, source: 'pending' });
  }
}

/**
 * Reject inputs whose mixed-case casing doesn't match EIP-55. All-lowercase
 * (e.g. `0xabc…`) and all-uppercase (`0xABC…`) inputs are by convention
 * "checksum not claimed" and pass through.
 */
function assertChecksumMatchesIfMixed(raw: string, checksummed: string): void {
  const hex = raw.slice(2);
  const allLower = hex === hex.toLowerCase();
  const allUpper = hex === hex.toUpperCase();
  if (allLower || allUpper) return;
  if (raw !== checksummed) {
    throw new Error(`Mismatched EIP-55 checksum: ${raw} expected ${checksummed}`);
  }
}

function resolveRpcUrl(chain: string): string | undefined {
  if (chain === 'arb-sepolia') {
    return process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
  }
  if (chain === 'rh-chain') {
    return process.env.RH_CHAIN_RPC; // pending RH SDK
  }
  return undefined;
}

// Verified testnet token addresses. USDC on Arb Sepolia is the Circle-issued
// testnet token; USDT/LINK fall back to env so operators can wire Sepolia
// equivalents without code changes.
//
// Audit U-39: USDC address pulled from the shared @/lib/testnet-tokens
// constant. Pre-fix two files hardcoded the same literal which is a
// drift risk on address rotation. `CODEX_USDC_ADDRESS` (legacy env name)
// stays for backward-compat; falls through to the shared constant which
// itself honors `NEXT_PUBLIC_USDC_ADDRESS`.
function resolveTokenAddress(chain: string, token: string): string | undefined {
  if (chain === 'arb-sepolia') {
    if (token === 'USDC') return process.env.CODEX_USDC_ADDRESS ?? ARB_SEPOLIA_USDC;
    if (token === 'USDT') return process.env.ARB_SEPOLIA_USDT;
    if (token === 'LINK') return process.env.ARB_SEPOLIA_LINK;
  }
  if (chain === 'rh-chain') {
    if (token === 'USDC') return process.env.RH_CHAIN_USDC;
    if (token === 'USDT') return process.env.RH_CHAIN_USDT;
    if (token === 'LINK') return process.env.RH_CHAIN_LINK;
  }
  return undefined;
}
