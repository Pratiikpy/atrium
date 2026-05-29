'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';

/**
 * Chain guard hook. Returns whether the connected wallet is on the
 * expected chain (Arbitrum Sepolia) and a function to switch.
 *
 * Every write hook should check `ok` before submitting — if false,
 * the tx would revert or hit the wrong contracts.
 */
export function useChainGuard() {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  const target = arbitrumSepolia;
  const ok = !isConnected || chain?.id === target.id;

  return {
    ok,
    current: chain ?? null,
    target,
    switchChain: () => switchChain({ chainId: target.id }),
  };
}
