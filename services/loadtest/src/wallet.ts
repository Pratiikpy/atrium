/**
 * Loadtest wallet, uses dedicated LOADTEST_EOA_KEY (Phase 6, FULL_AUDIT #68).
 *
 * NEVER uses the deployer key. Fails loudly if not configured.
 */

import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

export function getLoadtestWallet() {
  const key = process.env.LOADTEST_EOA_KEY;
  if (!key || key.trim() === '') {
    throw new Error(
      '[loadtest] FATAL: LOADTEST_EOA_KEY not set. ' +
        'This must be a dedicated testnet EOA, never the deployer key. ' +
        'See services/loadtest/.env.example and runbooks/loadtest-eoa.md.',
    );
  }
  if (process.env.DEPLOYER_PRIVATE_KEY && key === process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error(
      '[loadtest] FATAL: LOADTEST_EOA_KEY must NOT be the same as DEPLOYER_PRIVATE_KEY. ' +
        'Generate a separate testnet EOA for load testing.',
    );
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
  return createWalletClient({ account, chain: arbitrumSepolia, transport: http(rpcUrl) });
}
