import { describe, it, expect } from 'vitest';
import {
  inclusionGuard,
  isPinned,
  NOT_PINNED_REASON,
  INVALID_ADDRESS_REASON,
} from './lantern-inclusion-ui';

const VALID = '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce';

describe('isPinned', () => {
  it('is false for an empty or missing CID', () => {
    expect(isPinned('')).toBe(false);
    expect(isPinned(null)).toBe(false);
    expect(isPinned(undefined)).toBe(false);
  });
  it('is true for a non-empty CID', () => {
    expect(isPinned('QmX…')).toBe(true);
    expect(isPinned('bafy…')).toBe(true);
  });
});

describe('inclusionGuard (regression: unpinned tree must not blame the address)', () => {
  it('unpinned tree + VALID wallet -> not-pinned reason, NOT the address error', () => {
    const g = inclusionGuard('', VALID);
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.reason).toBe(NOT_PINNED_REASON);
      expect(g.reason).not.toBe(INVALID_ADDRESS_REASON);
    }
  });

  it('unpinned tree + empty wallet -> still not-pinned (pin checked first)', () => {
    expect(inclusionGuard(null, '')).toEqual({ ok: false, reason: NOT_PINNED_REASON });
  });

  it('pinned tree + malformed wallet -> the address error', () => {
    expect(inclusionGuard('Qmabc', 'not-an-address')).toEqual({
      ok: false,
      reason: INVALID_ADDRESS_REASON,
    });
  });

  it('pinned tree + valid wallet (whitespace tolerated) -> ok', () => {
    expect(inclusionGuard('Qmabc', `  ${VALID}  `)).toEqual({ ok: true });
  });
});
