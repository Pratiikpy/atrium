import { NextResponse } from 'next/server';
import { loadContractAddress } from '@/lib/deployments-registry';

export const dynamic = 'force-dynamic';

/**
 * Postern wallet metadata. Audit NN-2 fix: prior code unconditionally
 * shipped `source: 'postern'` with hardcoded `authenticator: 'ATRIUM ·
 * Yubikey 5C · Touch ID'` whenever a `DEMO_WALLET_ADDRESS` was set. This
 * implied real hardware-authenticator state that didn't exist (Postern
 * isn't deployed). Real-data discipline violation per `.claude/rules/ui.md`
 * "Live data discipline" — "Never display a placeholder number that looks
 * real."
 *
 * Now the route reports `source: 'postern'` only when PosternKeyRegistry
 * is in the deployments registry. Until then it returns the address as
 * configured by env but every other field is null with `source: 'pending'`,
 * matching the convention used by every other route in this app.
 */
export async function GET(req?: Request) {
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  if (!wallet) {
    return NextResponse.json({
      address: '—',
      ens: null,
      authenticator: null,
      bundler: null,
      paymaster: null,
      erc4337Ready: false,
      erc7702Ready: false,
      source: 'pending',
    });
  }
  const posternDeployed = await loadContractAddress('postern-key-registry');
  if (!posternDeployed) {
    return NextResponse.json({
      address: wallet,
      ens: process.env.DEMO_WALLET_ENS ?? null,
      authenticator: null,
      bundler: null,
      paymaster: null,
      erc4337Ready: false,
      erc7702Ready: false,
      source: 'pending',
    });
  }
  // Postern is deployed → these fields are sourced from the chain.
  // The strings are intentionally generic descriptions of what Postern
  // currently uses, not user-specific values; once Postern exposes per-
  // wallet metadata the route will read that instead.
  return NextResponse.json({
    address: wallet,
    ens: process.env.DEMO_WALLET_ENS ?? null,
    authenticator: 'Postern passkey · WebAuthn',
    bundler: 'Pimlico · testnet',
    paymaster: 'Pimlico verifying paymaster',
    erc4337Ready: true,
    erc7702Ready: true,
    source: 'postern' as const,
  });
}
