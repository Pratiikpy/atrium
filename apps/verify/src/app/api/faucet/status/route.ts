import { NextRequest, NextResponse } from 'next/server';
import { loadContractAddress } from '@/lib/deployments-registry';

export const dynamic = 'force-dynamic';

/**
 * Audit 2026-05-24 G-2 fix: prior route returned a hardcoded
 * `{available:false, reason:"adapter pending Curator whitelist"}` despite
 * the Faucet at 0x7f3a…2bbc being deployed, stocked, and reachable.
 *
 * Now reads on-chain:
 *   - Faucet.usdcDrop / ethDrop / cooldown (immutables)
 *   - IERC20(USDC).balanceOf(faucet) - does the faucet still have stock?
 *   - faucet.balance (ETH stock)
 *   - lastClaim[wallet] - wallet-specific cooldown
 *
 * `available` is true iff: faucet has at least one drop's worth of USDC,
 * has at least one drop's worth of ETH, and the wallet's cooldown has
 * elapsed (or wallet is unknown).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get('wallet') ?? process.env.DEMO_WALLET_ADDRESS ?? null;
  const faucetAddress = await loadContractAddress('faucet');

  if (!faucetAddress) {
    return NextResponse.json({
      available: false,
      reason: 'Faucet contract not in deployments registry',
      source: 'pending' as const,
    });
  }

  try {
    const { createPublicClient, http } = await import('viem');
    const { arbitrumSepolia } = await import('viem/chains');
    const client = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com'),
    });

    const faucetAbi = [
      { type: 'function', name: 'usdc', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
      { type: 'function', name: 'usdcDrop', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
      { type: 'function', name: 'ethDrop', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
      { type: 'function', name: 'cooldown', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint64' }] },
      { type: 'function', name: 'lastClaim', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint64' }] },
    ] as const;
    const erc20Abi = [
      { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
      { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
    ] as const;

    const addr = faucetAddress as `0x${string}`;
    const [usdcAddr, usdcDrop, ethDrop, cooldown] = await Promise.all([
      client.readContract({ address: addr, abi: faucetAbi, functionName: 'usdc' }) as Promise<`0x${string}`>,
      client.readContract({ address: addr, abi: faucetAbi, functionName: 'usdcDrop' }) as Promise<bigint>,
      client.readContract({ address: addr, abi: faucetAbi, functionName: 'ethDrop' }) as Promise<bigint>,
      client.readContract({ address: addr, abi: faucetAbi, functionName: 'cooldown' }) as Promise<bigint>,
    ]);

    const [faucetUsdcRaw, faucetEthWei] = await Promise.all([
      client.readContract({ address: usdcAddr, abi: erc20Abi, functionName: 'balanceOf', args: [addr] }) as Promise<bigint>,
      client.getBalance({ address: addr }),
    ]);

    // Audit B-S1 carryover: USDC has 6 decimals on Arbitrum Sepolia.
    const USDC_DECIMALS = 6n;
    const usdcDropFormatted = Number(usdcDrop) / Number(10n ** USDC_DECIMALS);
    const ethDropEth = Number(ethDrop) / 1e18;
    const faucetUsdcFormatted = Number(faucetUsdcRaw) / Number(10n ** USDC_DECIMALS);
    const faucetEthFormatted = Number(faucetEthWei) / 1e18;

    const hasUsdcStock = faucetUsdcRaw >= usdcDrop && usdcDrop > 0n;
    const hasEthStock = faucetEthWei >= ethDrop || ethDrop === 0n;

    let cooldownRemainingSec = 0;
    if (wallet && /^0x[0-9a-f]{40}$/i.test(wallet)) {
      const last = await client.readContract({
        address: addr,
        abi: faucetAbi,
        functionName: 'lastClaim',
        args: [wallet as `0x${string}`],
      }) as bigint;
      if (last > 0n) {
        const nextAllowed = last + cooldown;
        const nowSec = BigInt(Math.floor(Date.now() / 1000));
        if (nextAllowed > nowSec) {
          cooldownRemainingSec = Number(nextAllowed - nowSec);
        }
      }
    }

    const available = hasUsdcStock && hasEthStock && cooldownRemainingSec === 0;

    let reason: string | null = null;
    if (!hasUsdcStock) reason = `Faucet USDC stock ${faucetUsdcFormatted.toFixed(2)} below per-claim drop ${usdcDropFormatted.toFixed(2)}`;
    else if (!hasEthStock) reason = `Faucet ETH stock ${faucetEthFormatted.toFixed(4)} below per-claim drop ${ethDropEth.toFixed(4)}`;
    else if (cooldownRemainingSec > 0) reason = `Wallet cooldown ${cooldownRemainingSec}s remaining`;

    return NextResponse.json({
      available,
      reason,
      faucet: faucetAddress,
      usdc: usdcAddr,
      usdcDrop: usdcDropFormatted,
      ethDrop: ethDropEth,
      cooldownSec: Number(cooldown),
      faucetUsdcBalance: faucetUsdcFormatted,
      faucetEthBalance: faucetEthFormatted,
      walletCooldownRemainingSec: cooldownRemainingSec,
      source: 'faucet' as const,
    });
  } catch (err) {
    return NextResponse.json({
      available: false,
      reason: err instanceof Error ? `RPC probe failed: ${err.message.slice(0, 120)}` : 'RPC probe failed',
      source: 'pending' as const,
    });
  }
}
