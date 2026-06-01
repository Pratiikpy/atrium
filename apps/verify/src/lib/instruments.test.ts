import { describe, it, expect } from 'vitest';
import { keccak256, toBytes } from 'viem';
import {
  instrumentIdForVenue,
  instrumentIdsForVenues,
} from './instruments';
import { VENUES } from './venues';

/**
 * 062-FE7 regression. The mandate hook + server recompute used to hardcode
 * `instrumentsAllowed: []`. Sigil.caps_respected does
 * `instruments_allowed.any(|i| i == action.instrument_id)`, which is always
 * false for an empty list, so every UI-issued mandate was dead on the agent's
 * first action. These lock the shared derivation that both the open path and
 * the mandate path now read.
 */
describe('venue -> instrument-id mapping', () => {
  it('aave-horizon matches the canonical on-chain fill id (USDC-LEND)', () => {
    // scripts/build-aave-fill-envelope.mjs:48 INSTRUMENT = keccak256(toBytes('USDC-LEND'))
    expect(instrumentIdForVenue('aave-horizon')).toBe(keccak256(toBytes('USDC-LEND')));
  });

  it('every canonical venue resolves to a 32-byte instrument id', () => {
    for (const v of VENUES) {
      expect(instrumentIdForVenue(v.id)).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });

  it('a mandate over the full venue list authorizes each venue (non-empty)', () => {
    const allowlist = VENUES.map((v) => v.id);
    const ids = instrumentIdsForVenues(allowlist);
    expect(ids.length).toBe(allowlist.length);
    expect(ids.length).toBeGreaterThan(0);
    // Models Sigil.caps_respected: the mandate must contain the id the open
    // path would submit for each allowed venue.
    for (const v of VENUES) {
      expect(ids).toContain(instrumentIdForVenue(v.id));
    }
  });

  it('throws on an unknown venue instead of silently dropping it', () => {
    expect(() => instrumentIdsForVenues(['not-a-venue'])).toThrow();
  });
});
