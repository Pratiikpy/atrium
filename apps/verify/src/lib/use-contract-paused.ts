'use client';

import { useQuery } from '@tanstack/react-query';

type ContractSlug = 'coffer' | 'plinth' | 'aqueduct' | 'vigil' | 'sigil' | 'router';

/**
 * Reads pause state for a contract slug from Scribe entities.
 * Returns `{ paused, isLoading }`.
 */
export function useContractPaused(slug: ContractSlug) {
  const { data, isLoading } = useQuery({
    queryKey: ['contract-paused', slug],
    queryFn: async () => {
      const r = await fetch(`/api/protocol/pause-state?contract=${encodeURIComponent(slug)}`);
      if (!r.ok) return { paused: false };
      const j = await r.json();
      return { paused: Boolean(j.paused) };
    },
    refetchInterval: 30_000,
  });

  return { paused: data?.paused ?? false, isLoading };
}
