'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * Reads the Coffer (ERC-4626 USDC vault) address from the deployments
 * registry. Returns `null` until the contract is deployed, components
 * gating writes on this hook must check `address !== null` before
 * calling `useWriteContract`.
 *
 * Backed by `/api/deployments/address?slug=coffer` which already applies
 * the zero-address sentinel + env override rules from `lib/deployments-
 * registry.ts`.
 */
export function useContractAddress(slug: string) {
  return useQuery({
    queryKey: ['deployment-address', slug],
    queryFn: async (): Promise<`0x${string}` | null> => {
      try {
        const r = await fetch(`/api/deployments/address?slug=${slug}`);
        if (!r.ok) return null;
        const j = await r.json();
        return j.address ?? null;
      } catch {
        return null;
      }
    },
    refetchInterval: 60_000,
  });
}
