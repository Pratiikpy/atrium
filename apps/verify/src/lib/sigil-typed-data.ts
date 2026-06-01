import { VENUES } from '@/lib/venues';

/**
 * EIP-712 typed-data builder for IntentSigil. Mirrors
 * `contracts/sigil/src/eip712.rs` line-for-line so a signature produced by
 * the user's wallet recovers correctly inside the Stylus contract.
 *
 * Audit WW-1 (carried over from Rust): `venues_allowed` is declared
 * `bytes32[]` in the type string. Each entry is a 32-byte word with the
 * venue_id byte at position 31 (left-padded zeros, value at the right).
 * Declaring `uint8[]` here would compute a different struct hash and every
 * signature would silently fail recovery.
 *
 * Domain: name="AtriumSigil", version="1". chainId is the wallet's current
 * chain (must be 421614 for arb-sepolia). verifyingContract is the
 * deployed Sigil address from the registry.
 */

export interface IntentSigilEnvelope {
  owner: `0x${string}`;
  agent: `0x${string}`;
  venuesAllowedIds: string[]; // venue.id strings, mapped to venue_id bytes
  instrumentsAllowed: `0x${string}`[]; // 32-byte hex
  maxNotionalPerActionWei: bigint;
  maxTotalOpenNotionalWei: bigint;
  maxActionsPer24h: number;
  expiresAt: bigint; // unix seconds
  nonce: bigint;
  agentRevocationNonceAtSigning: bigint;
}

export interface SigilTypedDataPayload {
  domain: {
    name: 'AtriumSigil';
    version: '1';
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: {
    IntentSigil: { name: string; type: string }[];
  };
  primaryType: 'IntentSigil';
  message: {
    owner: `0x${string}`;
    agent: `0x${string}`;
    venues_allowed: `0x${string}`[];
    instruments_allowed: `0x${string}`[];
    max_notional_per_action_wei: bigint;
    max_total_open_notional_wei: bigint;
    max_actions_per_24h: number;
    expires_at: bigint;
    nonce: bigint;
    agent_revocation_nonce_at_signing: bigint;
  };
}

/**
 * Encode a venue id (1..255) as a 32-byte hex word with the byte at
 * position 31, matches `padded[31] = v` in contracts/sigil/src/eip712.rs
 * line 109.
 */
export function venueIdToBytes32(venueId: number): `0x${string}` {
  if (venueId < 0 || venueId > 255 || !Number.isInteger(venueId)) {
    throw new Error(`venueId out of u8 range: ${venueId}`);
  }
  const hex = venueId.toString(16).padStart(2, '0');
  return ('0x' + '00'.repeat(31) + hex) as `0x${string}`;
}

/**
 * Resolve a venue slug ('hyperliquid', 'aave-horizon', …) to its numeric
 * venue_id from the canonical VENUES list.
 */
export function venueIdForSlug(slug: string): number | null {
  return VENUES.find((v) => v.id === slug)?.venueId ?? null;
}

export function buildSigilTypedData(
  envelope: IntentSigilEnvelope,
  chainId: number,
  sigilAddress: `0x${string}`,
): SigilTypedDataPayload {
  // Map venue slugs to venue_id bytes; reject unknown slugs at the
  // boundary so the wallet doesn't sign a malformed envelope.
  const venuesAllowed: `0x${string}`[] = [];
  for (const slug of envelope.venuesAllowedIds) {
    const id = venueIdForSlug(slug);
    if (id == null) {
      throw new Error(`Unknown venue slug: ${slug}`);
    }
    venuesAllowed.push(venueIdToBytes32(id));
  }

  return {
    domain: {
      name: 'AtriumSigil',
      version: '1',
      chainId,
      verifyingContract: sigilAddress,
    },
    types: {
      IntentSigil: [
        { name: 'owner', type: 'address' },
        { name: 'agent', type: 'address' },
        { name: 'venues_allowed', type: 'bytes32[]' },
        { name: 'instruments_allowed', type: 'bytes32[]' },
        { name: 'max_notional_per_action_wei', type: 'uint256' },
        { name: 'max_total_open_notional_wei', type: 'uint256' },
        { name: 'max_actions_per_24h', type: 'uint32' },
        { name: 'expires_at', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'agent_revocation_nonce_at_signing', type: 'uint64' },
      ],
    },
    primaryType: 'IntentSigil',
    message: {
      owner: envelope.owner,
      agent: envelope.agent,
      venues_allowed: venuesAllowed,
      instruments_allowed: envelope.instrumentsAllowed,
      max_notional_per_action_wei: envelope.maxNotionalPerActionWei,
      max_total_open_notional_wei: envelope.maxTotalOpenNotionalWei,
      max_actions_per_24h: envelope.maxActionsPer24h,
      expires_at: envelope.expiresAt,
      nonce: envelope.nonce,
      agent_revocation_nonce_at_signing: envelope.agentRevocationNonceAtSigning,
    },
  };
}
