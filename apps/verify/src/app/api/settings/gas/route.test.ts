import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from './route';

/**
 * Iter 67 audit fix: locks the iter-37 honesty fix on
 * /api/settings/gas. Zero tests pinned it pre-iter-67.
 *
 * - Iter-37: pre-fix the server returned `sponsored: 0` in both
 *   the wallet-set and wallet-unset paths. The client gas-
 *   sponsorship.tsx then did `data?.sponsored ?? '-'`; JS nullish
 *   coalescing on 0 returns 0 (non-nullish) → UI rendered "0 / 10
 *   sponsored" as if measured. The fix: `sponsored: null` in both
 *   paths until Pimlico paymaster wiring lands.
 *
 * Same label-lie shape as iter-35 / iter-36 in protocol/metrics.
 */

const ORIGINAL_WALLET = process.env.DEMO_WALLET_ADDRESS;

beforeEach(() => {
  delete process.env.DEMO_WALLET_ADDRESS;
});

afterEach(() => {
  if (ORIGINAL_WALLET == null) delete process.env.DEMO_WALLET_ADDRESS;
  else process.env.DEMO_WALLET_ADDRESS = ORIGINAL_WALLET;
});

describe('GET /api/settings/gas, iter-37 sponsored:null honesty', () => {
  it('returns sponsored:null when wallet env unset', async () => {
    const json = await (await GET()).json();
    expect(json.sponsored).toBeNull();
    expect(json.cap).toBe(10);
    expect(json.active).toBe(false);
    expect(json.source).toBe('pending');
  });

  it('returns sponsored:null when wallet env is set (paymaster unwired)', async () => {
    process.env.DEMO_WALLET_ADDRESS = '0x' + 'a'.repeat(40);
    const json = await (await GET()).json();
    // Critical: this MUST be null, not 0. The iter-37 fix exists
    // because nullish-coalescing in the UI treats 0 as "real data."
    expect(json.sponsored).toBeNull();
    expect(json.cap).toBe(10);
    expect(json.active).toBe(false);
    expect(json.source).toBe('pending');
  });

  it('renders source:pending while paymaster is unwired (both paths)', async () => {
    // The wallet-set / unset paths return identical pending shapes
    // until the Pimlico paymaster wiring lands. This test locks that
    //, a refactor "lighting up" one path without wiring the actual
    // Pimlico read would silently advertise sponsorship that isn't
    // happening.
    let json = await (await GET()).json();
    expect(json.source).toBe('pending');

    process.env.DEMO_WALLET_ADDRESS = '0x' + 'b'.repeat(40);
    json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });
});
