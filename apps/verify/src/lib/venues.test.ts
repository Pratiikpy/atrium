import { describe, it, expect } from 'vitest';
import { VENUES, VENUE_COUNT, venueLabel } from './venues';

/**
 * Pin the seven-venue invariant + label resolution.
 *
 * Audit P-4 noted that "six/seven/eight" appeared inconsistently across
 * the UI. This file now locks the canonical answer to seven, with
 * RH-Chain explicitly omitted until the SDK ships (`human_left.md` #3).
 */
describe('VENUES list', () => {
  it('contains exactly seven entries, locked at the v1 testnet count', () => {
    expect(VENUES).toHaveLength(7);
    expect(VENUE_COUNT).toBe(7);
  });

  it('every venue has a unique id', () => {
    const ids = VENUES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every venue has a unique venueId integer', () => {
    const ids = VENUES.map((v) => v.venueId);
    expect(new Set(ids).size).toBe(ids.length);
    // Plinth's venue_id encoding is dense 1..N. Verify no gaps.
    const sorted = [...ids].sort((a, b) => a - b);
    sorted.forEach((id, i) => expect(id).toBe(i + 1));
  });

  it('every venue has a contract-slug that matches the adapter directory naming', () => {
    // The Foundry adapter suites mount contracts at
    // contracts/adapters/<adapterSlug>/src/. Match the seven slugs we
    // expect to find on disk.
    const slugs = new Set(VENUES.map((v) => v.adapterSlug));
    expect(slugs.has('hyperliquid')).toBe(true);
    expect(slugs.has('aave-horizon')).toBe(true);
    expect(slugs.has('pendle')).toBe(true);
    expect(slugs.has('curve')).toBe(true);
    expect(slugs.has('trade-xyz')).toBe(true);
    expect(slugs.has('polymarket')).toBe(true);
  });

  it('haircuts are within [1, 10_000] bps (sane range, not zero)', () => {
    for (const v of VENUES) {
      expect(v.haircutBps).toBeGreaterThan(0);
      expect(v.haircutBps).toBeLessThanOrEqual(10_000);
    }
  });

  it('binary-outcome venues carry the highest haircut (largest tail-loss model)', () => {
    // Polymarket is the only binary venue. Its haircut should be the max
    // across the seven, any future binary venue should follow suit.
    const polymarket = VENUES.find((v) => v.id === 'polymarket');
    expect(polymarket).toBeDefined();
    const maxHaircut = Math.max(...VENUES.map((v) => v.haircutBps));
    expect(polymarket!.haircutBps).toBe(maxHaircut);
  });
});

describe('venueLabel()', () => {
  it('returns the label for a known venueId', () => {
    // Hyperliquid HIP-3 is Plinth venue_id 1, locks the canonical mapping.
    expect(venueLabel(1)).toBe('Hyperliquid HIP-3');
    expect(venueLabel(2)).toBe('Aave Horizon');
  });

  it('returns null for null input (audit R-3 null-safe)', () => {
    // Audit R-3 fix: prior code returned the literal string "venue-null"
    // which never matched any real label and silently corrupted filters.
    expect(venueLabel(null)).toBeNull();
    expect(venueLabel(undefined)).toBeNull();
  });

  it('returns a stable fallback string for unknown numeric ids', () => {
    // Unknown id → "venue-N". This lets UI surfaces show *something* with
    // the numeric id visible, so a misconfigured Plinth deployment doesn't
    // render an empty cell that looks like missing data.
    expect(venueLabel(999)).toBe('venue-999');
    expect(venueLabel(0)).toBe('venue-0');
  });

  it('handles every canonical venueId', () => {
    for (const v of VENUES) {
      expect(venueLabel(v.venueId)).toBe(v.label);
    }
  });
});
