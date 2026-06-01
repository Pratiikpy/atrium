'use client';

import { useCallback } from 'react';
import { parseUnits } from 'viem';
import { useAccount } from 'wagmi';
import { useTxStatus } from './use-tx-status';
import { useContractAddress } from './use-coffer-address';
import { useChainGuard } from './use-chain-guard';
import { useContractPaused } from './use-contract-paused';
import { USDC_DECIMALS } from './testnet-tokens';

// 053-SEC10 fix (2026-05-30): the deployed Aqueduct exposes
// `send_collateral(uint64 destSelector, address dest_user, uint256 amount_wei,
// uint256 expires_at)` (nonpayable) — see contracts/aqueduct/src/Aqueduct.sol
// and subgraph/abis/Aqueduct.json. Pre-fix this hook declared
// `send(uint256,uint64,address)` (payable), which is a DIFFERENT 4-byte
// selector with the wrong arg order and no `expires_at`, so every transfer
// reverted on submit while the button was presented as working. Exported so
// use-transfer.test.ts can lock the selector to the deployed signature.
export const AQUEDUCT_SEND_ABI = [
  {
    type: 'function',
    name: 'send_collateral',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'destSelector', type: 'uint64' },
      { name: 'dest_user', type: 'address' },
      { name: 'amount_wei', type: 'uint256' },
      { name: 'expires_at', type: 'uint256' },
    ],
    outputs: [{ name: 'messageId', type: 'bytes32' }],
  },
] as const;

// Aqueduct.sol enforces `expires_at >= block.timestamp + MIN_EXPIRES_AT_DELTA`
// (1 hour). expires_at is the deadline after which the SENDER may claim_back
// if CCIP never delivered. Use a 24h window: comfortably past CCIP testnet
// finality, while still bounding how long a failed transfer's funds wait
// before the refund path opens.
const TRANSFER_EXPIRES_AT_WINDOW_SECONDS = 24 * 60 * 60;

// CCIP chain selectors for testnet
const CHAIN_SELECTORS: Record<string, bigint> = {
  'arb-sepolia': 3478487238524512106n,
  'rh-chain': 0n, // placeholder until RH-Chain CCIP lane ships
};

/**
 * A destination is supported only if it has a real (non-zero) CCIP selector.
 * Robinhood Chain has no CCIP lane on testnet yet (selector 0), so the UI must
 * NOT let a user submit Aqueduct.send_collateral with a 0 selector (it would
 * broadcast a dead tx). The transfer form gates the CTA on this.
 */
export function isDestChainSupported(destChain: string): boolean {
  const s = CHAIN_SELECTORS[destChain];
  return s !== undefined && s !== 0n;
}

/**
 * Transfer hook wrapping Aqueduct.send_collateral. Pre-flight checks: balance,
 * chain guard, Aqueduct paused state.
 */
export function useTransfer() {
  const { address } = useAccount();
  const { ok: chainOk } = useChainGuard();
  const { data: aqueductAddress } = useContractAddress('aqueduct');
  const { paused: aqueductPaused } = useContractPaused('aqueduct');
  const { state, send, reset } = useTxStatus();

  const submit = useCallback(
    async (params: { amount: string; destChain: string; destUser?: `0x${string}` }) => {
      if (!address) return;
      if (!chainOk) return;
      if (!aqueductAddress) return;
      if (aqueductPaused) return;

      const parsed = parseUnits(params.amount || '0', USDC_DECIMALS);
      if (parsed <= 0n) return;

      const selector = CHAIN_SELECTORS[params.destChain] ?? 0n;
      // Never broadcast a 0-selector send (an unwired CCIP lane like RH-Chain).
      // The form disables the CTA for these, so this is defense-in-depth.
      if (selector === 0n) return;
      const dest = params.destUser ?? address;
      const expiresAt = BigInt(
        Math.floor(Date.now() / 1000) + TRANSFER_EXPIRES_AT_WINDOW_SECONDS,
      );

      await send({
        address: aqueductAddress,
        abi: AQUEDUCT_SEND_ABI,
        functionName: 'send_collateral',
        args: [selector, dest, parsed, expiresAt],
      });
    },
    [address, chainOk, aqueductAddress, aqueductPaused, send],
  );

  const preflight = (() => {
    if (!address) return 'Connect wallet first';
    if (!chainOk) return 'Switch to Arbitrum Sepolia';
    if (!aqueductAddress) return 'Aqueduct not deployed';
    if (aqueductPaused) return 'Aqueduct is paused';
    return null;
  })();

  return {
    submit,
    status: state,
    txHash: state.kind === 'pending' || state.kind === 'success' ? state.hash : null,
    preflight,
    reset,
  };
}
