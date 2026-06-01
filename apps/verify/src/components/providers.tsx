'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Lightweight providers for the root layout, only TanStack Query.
 *
 * Audit J-H6 fix: wagmi + viem (~150KB gzipped) used to wrap every route via
 * `Providers` in the root layout. The landing page never calls a wagmi hook,
 * so we now keep the root layout wagmi-free. Routes that need wallet
 * primitives (e.g. /verify/[step], /lantern) opt into `WagmiProviders` via
 * `next/dynamic` at the route boundary, which keeps landing-page TTI under
 * the 1.5s budget.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Retry transient (5xx / network) faults only. A 4xx, especially
            // a 429, will not succeed on retry, and retrying a 429 amplifies
            // the rate limit that produced it into a self-feeding storm. Errors
            // that carry an HTTP status are filtered; status-less throws fall
            // back to a capped 2 retries (down from TanStack's default of 3).
            retry: (failureCount, error) => {
              const status =
                (error as { status?: number })?.status ??
                (error as { response?: { status?: number } })?.response?.status;
              if (typeof status === 'number' && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      })
  );
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
