'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Lightweight providers for the root layout — only TanStack Query.
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
          },
        },
      })
  );
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
