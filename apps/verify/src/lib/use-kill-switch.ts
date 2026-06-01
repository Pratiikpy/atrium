'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useConfig } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';

/**
 * Postern Kill Switch — the single button that revokes every Sigil mandate
 * and cancels every Postern session key for the connected wallet.
 *
 * Calls `PosternKillSwitch.activate(address[] agents_to_revoke)` with the
 * list of agents the user has issued mandates to. The agent list comes
 * from `/api/agents/my-mandates` (Scribe-backed; deduped on the way in).
 *
 * Honest failure modes:
 *   - `postern-kill-switch` not in deployments registry → 'kill_switch_not_deployed'
 *   - No active mandates → 'nothing_to_revoke' (UX safeguard so the user
 *     doesn't burn gas on a no-op)
 *   - Wallet rejects → wallet's actual error string
 *
 * Contract: contracts/postern-kill-switch/src/PosternKillSwitch.sol line 62
 * uses try/catch on each per-agent revoke so a single failing agent doesn't
 * block the whole emergency path (audit MMM-6).
 */

const KILL_SWITCH_ABI = [
  {
    type: 'function',
    name: 'activate',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agents_to_revoke', type: 'address[]' }],
    outputs: [],
  },
] as const;

export type KillSwitchStatus =
  | { kind: 'idle' }
  | { kind: 'submitting'; agentCount: number }
  | { kind: 'success'; hash: `0x${string}`; agentCount: number }
  | { kind: 'error'; reason: string };

export function useKillSwitch(killSwitchAddress: `0x${string}` | null) {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<KillSwitchStatus>({ kind: 'idle' });
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  async function activate() {
    if (!account) {
      setStatus({ kind: 'error', reason: 'wallet_not_connected' });
      return;
    }
    if (!killSwitchAddress) {
      setStatus({ kind: 'error', reason: 'kill_switch_not_deployed' });
      return;
    }

    // Pull the agent list from Scribe via the same route the agents page
    // uses. Deduplicating here means a user with two mandates to the same
    // agent doesn't pay for two revoke iterations on-chain.
    //
    // Phase theta audit follow-up (2026-05-25): pass the connected
    // wallet through to the API so the kill switch operates on the
    // CONNECTED user's mandates, not the demo wallet's. Pre-fix any
    // connected user clicking kill-switch would have revoked the demo
    // wallet's mandates and left their own intact — the opposite of
    // the user's intent.
    let agents: `0x${string}`[];
    try {
      const myMandatesUrl = account
        ? `/api/agents/my-mandates?wallet=${encodeURIComponent(account)}`
        : '/api/agents/my-mandates';
      const r = await fetch(myMandatesUrl);
      if (!r.ok) throw new Error(`my-mandates ${r.status}`);
      const j = await r.json();
      const seen = new Set<string>();
      agents = [];
      for (const m of j.mandates ?? []) {
        const a = (m.agent ?? '').toLowerCase(); // lowercase for set-membership dedup; Scribe stores lowercase
        if (!/^0x[0-9a-f]{40}$/.test(a)) continue;
        if (seen.has(a)) continue;
        seen.add(a);
        agents.push(a as `0x${string}`);
      }
    } catch (e) {
      setStatus({
        kind: 'error',
        reason: e instanceof Error ? e.message : 'mandate_list_unavailable',
      });
      return;
    }

    if (agents.length === 0) {
      setStatus({ kind: 'error', reason: 'nothing_to_revoke' });
      return;
    }

    setStatus({ kind: 'submitting', agentCount: agents.length });
    try {
      const hash = await writeContractAsync({
        address: killSwitchAddress,
        abi: KILL_SWITCH_ABI,
        functionName: 'activate',
        args: [agents],
      });
      // Emergency revoke must be CONFIRMED before we tell the user they're
      // safe. Gate success on the mined receipt, never bare submit.
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== 'success') {
        setStatus({ kind: 'error', reason: 'transaction_reverted' });
        return;
      }
      setStatus({ kind: 'success', hash, agentCount: agents.length });
    } catch (e) {
      setStatus({
        kind: 'error',
        reason: e instanceof Error ? e.message : 'unknown_error',
      });
    }
  }

  function reset() {
    setStatus({ kind: 'idle' });
  }

  return { status, activate, reset };
}
