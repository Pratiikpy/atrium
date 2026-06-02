'use client';

import { createContext, useContext } from 'react';

/**
 * Whether the connected wallet has a live SIWE session yet. Provided by
 * <SessionGate/> in the /app layout. Default `true`: outside the app subtree
 * (marketing, /verify) there is no session gating, so useScopedWallet returns
 * the connected address as before.
 *
 * useScopedWallet gates wallet-scoped queries on this so they don't fire a 401
 * in the ~seconds between connect and the SIWE handshake completing.
 */
export const SessionReadyContext = createContext<boolean>(true);

export function useSessionReady(): boolean {
  return useContext(SessionReadyContext);
}
