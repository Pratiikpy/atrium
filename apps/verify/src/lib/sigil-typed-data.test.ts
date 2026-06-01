import { describe, it, expect } from 'vitest';
import { buildSigilTypedData, venueIdToBytes32, venueIdForSlug } from './sigil-typed-data';
import { hashTypedData } from 'viem';

/**
 * Audit U-17 + WW-1 (carried from contracts/sigil/src/eip712.rs):
 *
 * The Stylus contract encodes each venue_id as a 32-byte word with the
 * byte at position 31 (left-padded zeros, right-aligned value). Declaring
 * `venues_allowed: 'uint8[]'` in the wagmi `signTypedData` call would
 * compute a different struct hash and every signature would silently
 * fail recovery inside Sigil.validate_action.
 *
 * These tests pin the encoding so a future refactor catches the drift.
 */

describe('venueIdToBytes32', () => {
  it('encodes single-byte ids with left-padded zeros', () => {
    expect(venueIdToBytes32(1)).toBe('0x' + '00'.repeat(31) + '01');
    expect(venueIdToBytes32(7)).toBe('0x' + '00'.repeat(31) + '07');
    expect(venueIdToBytes32(255)).toBe('0x' + '00'.repeat(31) + 'ff');
  });

  it('rejects out-of-range ids rather than truncating', () => {
    expect(() => venueIdToBytes32(-1)).toThrow();
    expect(() => venueIdToBytes32(256)).toThrow();
    expect(() => venueIdToBytes32(1.5)).toThrow();
  });

  it('matches the byte position the Rust contract reads', () => {
    // contracts/sigil/src/eip712.rs line 317:
    //   venues_allowed.push(bytes[slot_off + 31]);
    // The byte at index 31 must equal the venue_id integer for round-trip
    // recovery to work.
    for (const id of [1, 42, 200]) {
      const hex = venueIdToBytes32(id);
      // hex is "0x" + 64 chars; byte 31 is chars[62..64].
      const byte31 = parseInt(hex.slice(64, 66), 16);
      expect(byte31).toBe(id);
    }
  });
});

describe('venueIdForSlug', () => {
  it('resolves canonical slugs to their u8 venue_ids', () => {
    // contracts/portico-registry pins each adapter to a fixed venue_id.
    expect(venueIdForSlug('hyperliquid')).toBe(1);
    expect(venueIdForSlug('aave-horizon')).toBe(2);
    expect(venueIdForSlug('polymarket')).toBe(6);
  });

  it('returns null on unknown slugs without throwing', () => {
    expect(venueIdForSlug('totally-fake-venue')).toBeNull();
    expect(venueIdForSlug('')).toBeNull();
  });
});

describe('buildSigilTypedData', () => {
  const baseEnvelope = {
    owner: ('0x' + 'a'.repeat(40)) as `0x${string}`,
    agent: ('0x' + 'b'.repeat(40)) as `0x${string}`,
    venuesAllowedIds: ['hyperliquid', 'aave-horizon'],
    instrumentsAllowed: [] as `0x${string}`[],
    maxNotionalPerActionWei: 1_000_000n,
    maxTotalOpenNotionalWei: 10_000_000n,
    maxActionsPer24h: 24,
    expiresAt: 2_000_000_000n,
    nonce: 1n,
    agentRevocationNonceAtSigning: 0n,
  };
  const SIGIL = ('0x' + 'c'.repeat(40)) as `0x${string}`;

  it('produces a domain with name="AtriumSigil" and version="1"', () => {
    const t = buildSigilTypedData(baseEnvelope, 421614, SIGIL);
    expect(t.domain.name).toBe('AtriumSigil');
    expect(t.domain.version).toBe('1');
    expect(t.domain.chainId).toBe(421614);
    expect(t.domain.verifyingContract).toBe(SIGIL);
  });

  it('declares venues_allowed as bytes32[] (NOT uint8[])', () => {
    // WW-1 audit invariant: declaring uint8[] would compute a different
    // struct hash and every signature would silently fail recovery.
    const t = buildSigilTypedData(baseEnvelope, 421614, SIGIL);
    const venuesField = t.types.IntentSigil.find((f) => f.name === 'venues_allowed');
    expect(venuesField?.type).toBe('bytes32[]');
  });

  it('maps venue slugs to their venue_id byte representation', () => {
    const t = buildSigilTypedData(baseEnvelope, 421614, SIGIL);
    expect(t.message.venues_allowed).toEqual([
      '0x' + '00'.repeat(31) + '01', // hyperliquid
      '0x' + '00'.repeat(31) + '02', // aave-horizon
    ]);
  });

  it('throws on unknown venue slugs at the boundary', () => {
    expect(() =>
      buildSigilTypedData(
        { ...baseEnvelope, venuesAllowedIds: ['totally-fake-venue'] },
        421614,
        SIGIL,
      ),
    ).toThrow(/Unknown venue slug/);
  });

  it('passes through viem hashTypedData without throwing', () => {
    // The typed-data shape must be valid EIP-712, viem's hashTypedData
    // throws on malformed structures. This is the same call the production
    // code makes to compute the intent hash.
    const t = buildSigilTypedData(baseEnvelope, 421614, SIGIL);
    const hash = hashTypedData(t);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('hash changes when venue allowlist changes (envelope-content commitment)', () => {
    const t1 = buildSigilTypedData(baseEnvelope, 421614, SIGIL);
    const t2 = buildSigilTypedData(
      { ...baseEnvelope, venuesAllowedIds: ['hyperliquid'] },
      421614,
      SIGIL,
    );
    expect(hashTypedData(t1)).not.toBe(hashTypedData(t2));
  });

  it('hash changes when caps change', () => {
    const t1 = buildSigilTypedData(baseEnvelope, 421614, SIGIL);
    const t2 = buildSigilTypedData(
      { ...baseEnvelope, maxNotionalPerActionWei: 2_000_000n },
      421614,
      SIGIL,
    );
    expect(hashTypedData(t1)).not.toBe(hashTypedData(t2));
  });

  it('hash changes when verifyingContract changes (domain-bound)', () => {
    // EIP-712 domain separation: the same envelope signed for a different
    // verifyingContract MUST hash differently, otherwise a signature
    // intended for testnet Sigil could be replayed against mainnet Sigil.
    const t1 = buildSigilTypedData(baseEnvelope, 421614, SIGIL);
    const t2 = buildSigilTypedData(
      baseEnvelope,
      421614,
      ('0x' + 'd'.repeat(40)) as `0x${string}`,
    );
    expect(hashTypedData(t1)).not.toBe(hashTypedData(t2));
  });

  it('hash changes when chainId changes (chain-bound)', () => {
    const t1 = buildSigilTypedData(baseEnvelope, 421614, SIGIL);
    const t2 = buildSigilTypedData(baseEnvelope, 1, SIGIL);
    expect(hashTypedData(t1)).not.toBe(hashTypedData(t2));
  });
});
