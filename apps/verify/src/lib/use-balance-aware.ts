'use client';

import { useAccount, useBalance, useReadContract } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';

/**
 * Balance-aware hook. Returns the user's balance for a given token,
 * a formatted string, a max value (optionally subtracting gas for ETH),
 * and a submit-disabled reason when input exceeds balance.
 */
export function useBalanceAware(params: {
  token: 'eth' | `0x${string}`;
  decimals?: number;
  inputAmount?: string;
  gasBuffer?: bigint; // subtracted from max for ETH
}) {
  const { address } = useAccount();
  const { token, decimals = 18, inputAmount, gasBuffer = 0n } = params;

  // ETH balance
  const ethBalance = useBalance({
    address,
    query: { enabled: token === 'eth' && Boolean(address) },
  });

  // ERC-20 balance
  const erc20Balance = useReadContract({
    address: token !== 'eth' ? token : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: token !== 'eth' && Boolean(address) },
  });

  const balance: bigint | undefined =
    token === 'eth'
      ? ethBalance.data?.value
      : (erc20Balance.data as bigint | undefined);

  const effectiveDecimals = token === 'eth' ? 18 : decimals;
  const balanceFormatted = balance != null ? formatUnits(balance, effectiveDecimals) : null;

  const max = (() => {
    if (balance == null) return null;
    if (token === 'eth' && gasBuffer > 0n) {
      const net = balance > gasBuffer ? balance - gasBuffer : 0n;
      return formatUnits(net, effectiveDecimals);
    }
    return formatUnits(balance, effectiveDecimals);
  })();

  const disabledReason = (() => {
    if (!address) return 'Connect wallet first';
    if (balance == null) return null; // still loading
    if (!inputAmount || parseFloat(inputAmount) <= 0) return null;
    const inputParsed = parseFloat(inputAmount);
    const balanceParsed = parseFloat(balanceFormatted ?? '0');
    if (inputParsed > balanceParsed) {
      return token === 'eth' ? 'Insufficient ETH balance' : 'Insufficient balance';
    }
    return null;
  })();

  return { balance, balanceFormatted, max, disabledReason };
}
