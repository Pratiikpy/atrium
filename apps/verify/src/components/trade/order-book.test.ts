import { describe, it, expect } from 'vitest';
import { symbolForVenue, emptyBookMessage } from './order-book';
import { VENUES } from '@/lib/venues';

/**
 * Locks the venue → orderbook-symbol mapping. Pre-audit-U-14 the orderbook
 * fetched `symbol=HSLA-PERP` no matter which chip the user clicked. Now
 * every venue id in `@/lib/venues` must resolve to a meaningful symbol.
 *
 * Invariants:
 *   1. Every entry in VENUES has a symbol mapping (no silent default for
 *      a known venue, only unknown ids fall back to HSLA-PERP).
 *   2. The mapping is deterministic across renders.
 *   3. Unknown ids degrade safely (no throw) but to a named symbol so the
 *      UI doesn't render empty state.
 */
describe('symbolForVenue', () => {
  it('returns a specific symbol for each canonical venue id', () => {
    expect(symbolForVenue('hyperliquid')).toBe('HSLA-PERP');
    expect(symbolForVenue('aave-horizon')).toBe('USDC-LEND');
    expect(symbolForVenue('pendle-v2')).toBe('PT-USDC-DEC25');
    expect(symbolForVenue('curve')).toBe('3CRV');
    expect(symbolForVenue('trade-xyz')).toBe('rTSLA-PERP');
    expect(symbolForVenue('polymarket')).toBe('ELECTION-2026');
    expect(symbolForVenue('hl-hip4')).toBe('HSLA2-PERP');
  });

  it('covers every venue declared in @/lib/venues (no orphan ids)', () => {
    for (const v of VENUES) {
      const sym = symbolForVenue(v.id);
      expect(sym).toBeTruthy();
      // If a new venue is added to VENUES without updating the map, this
      // test fails because the fallback `HSLA-PERP` is shared with the
      // hyperliquid id, distinguish by checking that the symbol is not
      // the fallback for non-hyperliquid venues.
      if (v.id !== 'hyperliquid') {
        expect(sym).not.toBe('HSLA-PERP');
      }
    }
  });

  it('falls back to HSLA-PERP for unknown ids rather than throwing', () => {
    expect(symbolForVenue('does-not-exist')).toBe('HSLA-PERP');
    expect(symbolForVenue('')).toBe('HSLA-PERP');
  });

  it('is deterministic across multiple calls', () => {
    const a = symbolForVenue('curve');
    const b = symbolForVenue('curve');
    const c = symbolForVenue('curve');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

/**
 * n=10: the empty-book message must reflect the SELECTED venue, never the
 * hardcoded "Hyperliquid HIP-3" string regardless of selection.
 */
describe('emptyBookMessage', () => {
  it('never names Hyperliquid HIP-3 for the Aave Horizon venue', () => {
    const msg = emptyBookMessage('aave-horizon');
    expect(msg).not.toMatch(/Hyperliquid/i);
    expect(msg).toMatch(/Aave Horizon/);
    // Aave Horizon is a live lending market - it should say it has no perp book,
    // not imply a pending adapter.
    expect(msg).toMatch(/lending market/i);
  });

  it('names the selected scaffold venue in the pending-adapter message', () => {
    const msg = emptyBookMessage('pendle-v2');
    expect(msg).toMatch(/Pendle V2/);
    expect(msg).not.toMatch(/Hyperliquid HIP-3/);
  });

  it('names Hyperliquid HIP-3 only when that venue is selected', () => {
    expect(emptyBookMessage('hyperliquid')).toMatch(/Hyperliquid HIP-3/);
  });
});
