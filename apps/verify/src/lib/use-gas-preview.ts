'use client';

import { useState, useEffect, useRef, useDeferredValue } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther } from 'viem';

/**
 * Gas estimation with USD preview. Uses useDeferredValue for debouncing
 * (no setTimeout, banned by project convention). Cached 60s.
 * Reads ETH/USD from /api/protocol/eth-price (backed by PlinthOracle).
 */
export function useGasPreview(params: {
  to?: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
  enabled?: boolean;
}) {
  const { to, data, value, enabled = true } = params;
  const client = usePublicClient();
  const [gasEstUsd, setGasEstUsd] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cacheRef = useRef<{ key: string; value: string; ts: number } | null>(null);

  // Deferred values for natural debouncing
  const deferredTo = useDeferredValue(to);
  const deferredData = useDeferredValue(data);

  useEffect(() => {
    if (!enabled || !deferredTo || !client) {
      setGasEstUsd(null);
      return;
    }

    const key = `${deferredTo}:${deferredData ?? ''}:${value ?? 0n}`;
    if (cacheRef.current && cacheRef.current.key === key && Date.now() - cacheRef.current.ts < 60_000) {
      setGasEstUsd(cacheRef.current.value);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const gasEstimate = await client.estimateGas({ to: deferredTo, data: deferredData, value });
        const gasPrice = await client.getGasPrice();
        const costWei = gasEstimate * gasPrice;
        const costEth = parseFloat(formatEther(costWei));

        let ethUsd = 3000; // fallback
        try {
          const r = await fetch('/api/protocol/eth-price');
          if (r.ok) {
            const j = await r.json();
            if (j.priceUsd) ethUsd = parseFloat(j.priceUsd);
          }
        } catch { /* use fallback */ }

        if (!cancelled) {
          const usd = (costEth * ethUsd).toFixed(4);
          setGasEstUsd(`$${usd}`);
          cacheRef.current = { key, value: `$${usd}`, ts: Date.now() };
        }
      } catch {
        if (!cancelled) setGasEstUsd(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [deferredTo, deferredData, value, enabled, client]);

  return { gasEstUsd, isLoading };
}
