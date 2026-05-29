'use client';

import { useCallback } from 'react';
import { parseUnits } from 'viem';
import { useAccount } from 'wagmi';
import { useTxStatus } from './use-tx-status';
import { useContractAddress } from './use-coffer-address';
import { useChainGuard } from './use-chain-guard';
import { useContractPaused } from './use-contract-paused';
import { USDC_DECIMALS } from './testnet-tokens';

const AQUEDUCT_SEND_ABI = [
  {
    type: 'function',
    name: 'send',
    stateMutability: 'payable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'dest_chain_selector', type: 'uint64' },
      { name: 'dest_user', type: 'address' },
    ],
    outputs: [{ name: 'message_id', type: 'bytes32' }],
  },
] as const;

// CCIP chain selectors for testnet
const CHAIN_SELECTORS: Record<string, bigint> = {
  'arb-sepolia': 3478487238524512106n,
  'rh-chain': 0n, // placeholder until RH-Chain ships
};

/**
 * Transfer hook wrapping Aqueduct.send. Pre-flight checks: balance,
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
      const dest = params.destUser ?? address;

      await send({
        address: aqueductAddress,
        abi: AQUEDUCT_SEND_ABI,
        functionName: 'send',
        args: [parsed, selector, dest],
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
