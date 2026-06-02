'use client';

import { useAccount } from 'wagmi';
import { useSessionReady } from './session-ready';

/**
 * Phase theta audit follow-up (2026-05-25). Single source of truth for
 * "which wallet should this page's data be scoped to". Pre-fix every
 * portfolio component fetched /api/portfolio/* with no wallet param;
 * the backend defaulted to DEMO_WALLET_ADDRESS, so a connected user
 * always saw the demo wallet's data, single-tenant behavior buried
 * behind a multi-tenant UI.
 *
 * Now: the API routes accept ?wallet=0x<40-hex> as the canonical
 * override. This hook returns the connected wallet (from wagmi) so
 * every fetch can pass it through. When no wallet is connected the
 * hook returns null and the API falls back to DEMO_WALLET_ADDRESS -
 * matches the pre-fix behavior so smoke tests + cohort demo flow
 * stay working.
 *
 * Usage:
 *
 *   const wallet = useScopedWallet();
 *   const { data } = useQuery({
 *     queryKey: ['positions', wallet],
 *     queryFn: () => fetch(walletQuery('/api/portfolio/positions', wallet)).then(r => r.json()),
 *   });
 */
export function useScopedWallet(): `0x${string}` | null {
  const { address } = useAccount();
  const sessionReady = useSessionReady();
  // Hold wallet-scoped queries until the SIWE session exists: a connected
  // wallet with no session yet would 401 on every read (the ~3s window between
  // connect and the handshake). Returning null keeps `enabled: wallet != null`
  // false until <SessionGate/> flips ready, so the reads fire once and succeed.
  // Outside the app subtree the context default is true (no gating).
  if (!address || !sessionReady) return null;
  return address;
}

/**
 * Append `wallet=<addr>` to the URL when a wallet is connected. When
 * `wallet` is null, returns the URL unchanged so the backend's
 * DEMO_WALLET_ADDRESS fallback applies. Preserves any existing query
 * string (e.g. `?window=30d` on buying-power).
 */
export function walletQuery(url: string, wallet: string | null): string {
  if (!wallet) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}wallet=${encodeURIComponent(wallet)}`;
}
