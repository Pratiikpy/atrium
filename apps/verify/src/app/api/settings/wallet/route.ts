import { NextResponse } from 'next/server';
import { loadContractAddress } from '@/lib/deployments-registry';

export const dynamic = 'force-dynamic';

/**
 * Postern wallet metadata. Audit NN-2 fix: prior code unconditionally
 * shipped `source: 'postern'` with hardcoded `authenticator: 'ATRIUM ·
 * Yubikey 5C · Touch ID'` whenever a `DEMO_WALLET_ADDRESS` was set. This
 * implied real hardware-authenticator state that didn't exist (Postern
 * isn't deployed). Real-data discipline violation per `docs/conventions/ui.md`
 * "Live data discipline", "Never display a placeholder number that looks
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
      address: '-',
      ens: null,
      authenticator: null,
      bundler: null,
      paymaster: null,
      erc4337Ready: false,
      erc7702Ready: false,
      sessionKeyRegistry: null,
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
      sessionKeyRegistry: null,
      source: 'pending',
    });
  }
  // 063-FE8 fix: pre-fix this branch hardcoded `bundler: 'Pimlico · testnet'`,
  // `paymaster: 'Pimlico verifying paymaster'`, `erc4337Ready/erc7702Ready:
  // true` whenever PosternKeyRegistry was deployed. None of that exists: there
  // is no Pimlico/bundler/paymaster or ERC-4337/7702 SDK in the repo, and
  // PosternKeyRegistry is a session-key registry whose own
  // `_isAuthenticatedPosternWallet` returns false with a Year-2 AA TODO.
  // Report the honest state. What IS real: the app's only connector is the
  // Coinbase Smart Wallet (passkey) per lib/wagmi.ts, and the session-key
  // registry is on-chain at `posternDeployed`.
  return NextResponse.json({
    address: wallet,
    ens: process.env.DEMO_WALLET_ENS ?? null,
    authenticator: 'Coinbase Smart Wallet · passkey',
    bundler: null,
    paymaster: null,
    erc4337Ready: false,
    erc7702Ready: false,
    sessionKeyRegistry: posternDeployed,
    source: 'postern' as const,
  });
}
