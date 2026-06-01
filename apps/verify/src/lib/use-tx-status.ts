'use client';

import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useChainGuard } from './use-chain-guard';

/**
 * Unified tx lifecycle hook: idle → submitting → pending → success | error.
 *
 * - `submitting`: writeContractAsync has been called, awaiting wallet signature.
 * - `pending`: tx hash received, waiting for on-chain receipt.
 * - `success`: receipt confirms `status === 'success'`.
 * - `error`: any failure (wallet reject, revert, etc.)
 *
 * Replaces the pattern of jumping directly from submitting to success
 * without waiting for the receipt.
 */
export type TxState =
  | { kind: 'idle' }
  | { kind: 'wrong_chain' }
  | { kind: 'submitting' }
  | { kind: 'pending'; hash: `0x${string}` }
  | { kind: 'success'; hash: `0x${string}` }
  | { kind: 'error'; reason: string };

export function useTxStatus() {
  const [state, setState] = useState<TxState>({ kind: 'idle' });
  const { writeContractAsync } = useWriteContract();
  const { ok: chainOk } = useChainGuard();

  // Receipt watcher, only active when we have a pending hash.
  const pendingHash = state.kind === 'pending' ? state.hash : undefined;
  const receipt = useWaitForTransactionReceipt({
    hash: pendingHash,
    query: {
      enabled: Boolean(pendingHash),
    },
  });

  // Promote pending → success/error when receipt arrives.
  if (state.kind === 'pending' && receipt.data) {
    if (receipt.data.status === 'success') {
      setState({ kind: 'success', hash: state.hash });
    } else {
      setState({ kind: 'error', reason: 'Transaction reverted on-chain' });
    }
  }
  if (state.kind === 'pending' && receipt.error) {
    setState({ kind: 'error', reason: receipt.error.message });
  }

  const send = useCallback(
    async (params: Parameters<typeof writeContractAsync>[0]) => {
      if (!chainOk) {
        setState({ kind: 'wrong_chain' });
        return null;
      }
      setState({ kind: 'submitting' });
      try {
        const hash = await writeContractAsync(params);
        setState({ kind: 'pending', hash });
        return hash;
      } catch (e) {
        setState({
          kind: 'error',
          reason: e instanceof Error ? e.message : 'unknown_error',
        });
        return null;
      }
    },
    [writeContractAsync, chainOk],
  );

  const reset = useCallback(() => setState({ kind: 'idle' }), []);

  return { state, send, reset };
}
