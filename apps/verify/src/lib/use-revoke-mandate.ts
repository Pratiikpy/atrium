'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useConfig } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { useContractAddress } from '@/lib/use-coffer-address';

/**
 * Revoke a single Intent Sigil mandate. Wraps Sigil.revoke(intentHash)
 * in a controlled state machine. Pairs with the new per-row Revoke
 * button on the My Mandates table. Spec: ATRIUM_FULL_FLOW_DESIGN.md
 * "Revoking a single mandate".
 *
 * Honest failure modes:
 *  - Sigil contract not deployed → 'sigil_not_deployed'
 *  - Wallet not connected → 'wallet_not_connected'
 *  - Already revoked → contract reverts with 'already_revoked' (Sigil
 *    treats this idempotently, the second call is harmless)
 *  - Wallet rejects → wallet error message
 *
 * The kill-switch path (revoke-all) uses a different hook
 * (useKillSwitch) because it survives Sigil being paused; this hook
 * only handles the per-intent revoke.
 */

const SIGIL_REVOKE_ABI = [
  {
    type: 'function',
    name: 'revoke',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'intent_hash', type: 'bytes32' }],
    outputs: [],
  },
] as const;

export type RevokeStatus =
  | { kind: 'idle' }
  | { kind: 'submitting'; intentHash: string }
  | { kind: 'success'; intentHash: string; hash: `0x${string}` }
  | { kind: 'error'; intentHash: string; reason: string };

export function useRevokeMandate() {
  const { address: account } = useAccount();
  const { data: sigilAddress } = useContractAddress('sigil');
  const [status, setStatus] = useState<RevokeStatus>({ kind: 'idle' });
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  async function revoke(intentHash: string) {
    if (!account) {
      setStatus({ kind: 'error', intentHash, reason: 'wallet_not_connected' });
      return;
    }
    if (!sigilAddress) {
      setStatus({ kind: 'error', intentHash, reason: 'sigil_not_deployed' });
      return;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(intentHash)) {
      setStatus({ kind: 'error', intentHash, reason: 'invalid_intent_hash' });
      return;
    }
    setStatus({ kind: 'submitting', intentHash });
    try {
      const hash = await writeContractAsync({
        address: sigilAddress,
        abi: SIGIL_REVOKE_ABI,
        functionName: 'revoke',
        args: [intentHash as `0x${string}`],
      });
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== 'success') {
        setStatus({ kind: 'error', intentHash, reason: 'transaction_reverted' });
        return;
      }
      setStatus({ kind: 'success', intentHash, hash });
    } catch (e) {
      setStatus({
        kind: 'error',
        intentHash,
        reason: e instanceof Error ? e.message : 'submit_failed',
      });
    }
  }

  function reset() {
    setStatus({ kind: 'idle' });
  }

  return { status, revoke, reset };
}
