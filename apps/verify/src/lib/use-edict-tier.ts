'use client';

import { useAccount, useReadContract } from 'wagmi';
import { useContractAddress } from './use-coffer-address';

const EDICT_ABI = [
  {
    type: 'function',
    name: 'tierOf',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: 'tier', type: 'uint8' }],
  },
] as const;

/**
 * Reads the user's jurisdiction tier from Edict.tierOf(user).
 * Returns 0 | 1 | 2 | 3 | null (null = loading or not deployed).
 */
export function useEdictTier(): number | null {
  const { address } = useAccount();
  const { data: edictAddress } = useContractAddress('edict');

  const { data } = useReadContract({
    address: edictAddress ?? undefined,
    abi: EDICT_ABI,
    functionName: 'tierOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && edictAddress) },
  });

  return data != null ? Number(data) : null;
}
