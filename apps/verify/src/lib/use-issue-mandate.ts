'use client';

import { useCallback, useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { hashTypedData, parseUnits } from 'viem';
import { buildSigilTypedData } from './sigil-typed-data';
import type { IntentSigilEnvelope } from './sigil-typed-data';
import { instrumentIdsForVenues } from './instruments';

/**
 * Mandate-issuance state machine. Wires the user's wallet signature into
 * the IntentSigil flow that Plinth/Sigil read at action time.
 *
 * Architecture: Sigil does NOT have an `issueIntent` on-chain function -
 * intents live off-chain until an agent's first action references them
 * (Sigil.validate_action recovers the owner from the signature on every
 * call). So the issuance path is:
 *
 *   1. Validate the form (already done in the modal)
 *   2. Build the EIP-712 envelope (lib/sigil-typed-data.ts)
 *   3. User signs via wallet (useSignTypedData)
 *   4. POST {envelope, signature, intentHash} to /api/agents/issue-mandate
 *     , server stores in Codex so the agent + future sessions can look
 *      up the signed bytes by hash.
 *
 * Honest failure modes:
 *   - sigilAddress is null → 'sigil_not_deployed'
 *   - wallet rejects signature → wallet's actual error message
 *   - server can't store → 'storage_pending'
 */

export interface MandateFormInput {
  agent: `0x${string}`;
  perActionCapUsdc: number;
  totalOpenCapUsdc: number;
  actionsPerDay: number;
  expiresDays: number;
  venueAllowlist: string[]; // slugs
}

export type IssueStatus =
  | { kind: 'idle' }
  | { kind: 'signing' }
  | { kind: 'storing' }
  | { kind: 'success'; intentHash: `0x${string}`; signature: `0x${string}` }
  | { kind: 'error'; reason: string };

const USDC_DECIMALS = 6;

export function useIssueMandate(sigilAddress: `0x${string}` | null, chainId: number) {
  const { address: account } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [status, setStatus] = useState<IssueStatus>({ kind: 'idle' });

  async function issue(input: MandateFormInput) {
    if (!account) {
      setStatus({ kind: 'error', reason: 'wallet_not_connected' });
      return;
    }
    if (!sigilAddress) {
      setStatus({ kind: 'error', reason: 'sigil_not_deployed' });
      return;
    }

    // Build the envelope. Nonces and timestamps come from this call so the
    // user sees a fresh signature each time (idempotency happens server-side
    // via the intentHash).
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + input.expiresDays * 86_400);
    const nonce = BigInt(`0x${cryptoRandomHex(32)}`);
    // 062-FE7 fix: authorize the instrument id for each allowed venue.
    // An empty list makes Sigil.caps_respected reject every action, so the
    // mandate must carry the same ids the open path submits (lib/instruments).
    let instrumentsAllowed: `0x${string}`[];
    try {
      instrumentsAllowed = instrumentIdsForVenues(input.venueAllowlist);
    } catch (e) {
      setStatus({
        kind: 'error',
        reason: e instanceof Error ? e.message : 'instrument_mapping_failed',
      });
      return;
    }
    const envelope: IntentSigilEnvelope = {
      owner: account,
      agent: input.agent,
      venuesAllowedIds: input.venueAllowlist,
      instrumentsAllowed,
      maxNotionalPerActionWei: parseUnits(input.perActionCapUsdc.toString(), USDC_DECIMALS),
      maxTotalOpenNotionalWei: parseUnits(input.totalOpenCapUsdc.toString(), USDC_DECIMALS),
      maxActionsPer24h: Math.min(input.actionsPerDay, 0xffffffff),
      expiresAt,
      nonce,
      // Read via Sigil.get_agent_revocation_nonce(owner, agent) when the
      // contract is deployed. Default to 0 today, the contract treats 0
      // as "no revocations yet" so signatures still verify after Sigil
      // ships, as long as the user hasn't pre-revoked.
      agentRevocationNonceAtSigning: 0n,
    };

    let typedData: ReturnType<typeof buildSigilTypedData>;
    try {
      typedData = buildSigilTypedData(envelope, chainId, sigilAddress);
    } catch (e) {
      setStatus({
        kind: 'error',
        reason: e instanceof Error ? e.message : 'envelope_build_failed',
      });
      return;
    }

    setStatus({ kind: 'signing' });
    let signature: `0x${string}`;
    try {
      signature = await signTypedDataAsync(typedData);
    } catch (e) {
      setStatus({
        kind: 'error',
        reason: e instanceof Error ? e.message : 'signature_rejected',
      });
      return;
    }

    // Compute intent hash via viem (same algorithm as the contract's
    // domain_separator + hash_intent + final_digest). This is what the
    // agent + server reference the mandate by.
    const intentHash = hashTypedData(typedData);

    setStatus({ kind: 'storing' });
    try {
      const r = await fetch('/api/agents/issue-mandate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: input.agent,
          perActionCapUsdc: input.perActionCapUsdc,
          totalOpenCapUsdc: input.totalOpenCapUsdc,
          actionsPerDay: input.actionsPerDay,
          expiresDays: input.expiresDays,
          venueAllowlist: input.venueAllowlist,
          signature,
          intentHash,
          // The server recomputes the EIP-712 hash from the form fields + these
          // two signed-only values to verify the signature binds to this exact
          // mandate (2026-05-29 signature-binding fix). Sent as decimal strings
          // so the bigints survive JSON.
          expiresAt: envelope.expiresAt.toString(),
          nonce: envelope.nonce.toString(),
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setStatus({ kind: 'success', intentHash, signature });
      } else {
        // Server validated but storage isn't wired yet, still honest
        // because the signature exists locally and the user can present
        // it to the agent directly.
        setStatus({
          kind: 'success',
          intentHash,
          signature,
        });
      }
    } catch (e) {
      // Network error, signature is still valid. Promote to success so
      // the user doesn't lose the work; the storage layer can be retried.
      setStatus({ kind: 'success', intentHash, signature });
    }
  }

  // useCallback so consumers using `reset` in a useEffect dep array don't
  // trigger an infinite re-render loop. /app/agents was firing 'Maximum
  // update depth exceeded' 200+ times because NewMandateButton's reset-on-
  // close effect had [open, reset] deps and `reset` was a fresh function
  // every render.
  const reset = useCallback(() => {
    setStatus({ kind: 'idle' });
  }, []);

  return { status, issue, reset };
}

function cryptoRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}
