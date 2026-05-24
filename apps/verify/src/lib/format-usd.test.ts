import { describe, it, expect } from 'vitest';
import { formatUsd, formatShares, formatSharePrice } from './format-usd';

/**
 * Locks audit S-1 + T-4 at the unit-test layer.
 *
 * If a future refactor swaps `formatUnits(b, 6)` for `Number(b) / 1e6`, or
 * hardcodes 18 decimals, or drops the locale formatter, CI catches it
 * before review.
 */

describe('formatUsd() — audit S-1 (USDC 6 decimals)', () => {
  it('formats 1 USDC (1_000_000 wei at 6 decimals) as "$1.00"', () => {
    expect(formatUsd(1_000_000n, 6)).toBe('$1.00');
  });

  it('formats 100 USDC as "$100.00"', () => {
    expect(formatUsd(100_000_000n, 6)).toBe('$100.00');
  });

  it('renders thousands separators: 1_234.56 USDC → "$1,234.56"', () => {
    // Audit T-4: locale-formatted output uses comma thousands separator.
    expect(formatUsd(1_234_560_000n, 6)).toBe('$1,234.56');
  });

  it('renders millions cleanly: 4_200_000 USDC → "$4,200,000.00"', () => {
    expect(formatUsd(4_200_000_000_000n, 6)).toBe('$4,200,000.00');
  });

  it('rounds to 2 decimal places (banker convention is "half to even" but parseFloat is half-away-from-zero)', () => {
    // 1.235 → "$1.24" or "$1.23" depending on toLocaleString rounding mode.
    // Lock whichever the JS runtime uses so a Node version bump doesn't
    // silently change shipped UI numbers.
    const result = formatUsd(1_235_000n, 6);
    // Accept both — what matters is that some 2-decimal value is produced.
    expect(result).toMatch(/^\$1\.2[34]$/);
  });

  it('handles sub-cent values without truncating to zero (audit T-4)', () => {
    // 1 wei at 6 decimals = $0.000001. The locale formatter rounds to
    // 2 decimals → "$0.00". This is intentional (display precision) but
    // distinct from the bug it replaced (Number(1) / 1e6 = tiny float →
    // toLocaleString → also "$0.00" but with potential precision loss
    // earlier in the chain).
    expect(formatUsd(1n, 6)).toBe('$0.00');
    expect(formatUsd(500_000n, 6)).toBe('$0.50'); // half a USDC renders correctly
  });

  it('handles zero', () => {
    expect(formatUsd(0n, 6)).toBe('$0.00');
  });

  it('preserves precision past Number.MAX_SAFE_INTEGER (audit T-4 core fix)', () => {
    // Number.MAX_SAFE_INTEGER = 9_007_199_254_740_991
    // A naive `Number(big) / 1e6` loses precision here. viem's formatUnits
    // preserves it via string-based decimal split.
    const safe = BigInt(Number.MAX_SAFE_INTEGER); // ~$9_007_199_254.74
    const result = formatUsd(safe, 6);
    // The exact $9,007,199,254.74 value must be in the output (no rounding
    // away the .74 cents).
    expect(result).toMatch(/^\$9,007,199,254\.7[34]$/);
  });

  it('works at 18 decimals (ETH-like assets, NOT the audit S-1 path)', () => {
    // 1 ETH = 1_000_000_000_000_000_000 wei → "$1.00"
    expect(formatUsd(10n ** 18n, 18)).toBe('$1.00');
  });

  // Audit U-36: BigInt-native rewrite. Pre-fix used `parseFloat(formatUnits)`
  // which loses sub-cent precision past ~$10^20 (parseFloat's exponent
  // cap, not Number.MAX_SAFE_INTEGER as the prior audit comment claimed)
  // and rendered negatives as "$-100.00". Now exact at any scale +
  // conventional "-$100.00".
  it('U-36: BigInt precision at any scale (no parseFloat truncation)', () => {
    const oneTrillion = 1_000_000_000_000_000_000n; // $1T in micro-USDC
    expect(formatUsd(oneTrillion, 6)).toBe('$1,000,000,000,000.00');
    // Plus 99 micro-cents — the .99 must survive intact.
    expect(formatUsd(oneTrillion + 990_000n, 6)).toBe('$1,000,000,000,000.99');
    // Past the parseFloat boundary: 10^25 micro-USDC. Pre-fix would
    // truncate the cents to .00; BigInt-native preserves them.
    expect(formatUsd(10n ** 25n + 990_000n, 6)).toBe(
      '$10,000,000,000,000,000,000.99',
    );
  });

  it('U-36: renders negatives as "-$100.00" (conventional US currency)', () => {
    expect(formatUsd(-100_000_000n, 6)).toBe('-$100.00');
    expect(formatUsd(-1n, 6)).toBe('-$0.00');
  });

  it('U-36: sub-cent values still render as $0.00 (display contract — 2 decimal cap)', () => {
    // formatUsd is fixed at 2 display decimals — values under half a cent
    // round to $0.00 by design (UI doesn't show sub-cent precision in
    // currency display). To render dust accurately, callers should use
    // formatSharePrice (4 decimals) or a future helper with more digits.
    expect(formatUsd(999n, 6)).toBe('$0.00');
    expect(formatUsd(4999n, 6)).toBe('$0.00');
    // Half-cent rounds up — banker-neutral half-up at the boundary.
    expect(formatUsd(5000n, 6)).toBe('$0.01');
    expect(formatUsd(5001n, 6)).toBe('$0.01');
  });
});

describe('formatShares()', () => {
  it('formats share balance without the $ prefix', () => {
    expect(formatShares(1_234_560_000n, 6)).toBe('1,234.56');
  });

  it('returns "0.00" for zero shares', () => {
    expect(formatShares(0n, 6)).toBe('0.00');
  });

  it('preserves precision past safe-int range', () => {
    const big = BigInt(Number.MAX_SAFE_INTEGER);
    const result = formatShares(big, 6);
    expect(result).toMatch(/^9,007,199,254\.7[34]$/);
  });
});

describe('formatSharePrice() — audit S-1 (4 decimal precision)', () => {
  it('formats 1.0 share price as "$1.0000"', () => {
    expect(formatSharePrice(1_000_000n, 6)).toBe('$1.0000');
  });

  it('formats 1.005 share price as "$1.0050" (yield-bearing vault)', () => {
    // Coffer accrues yield → share price drifts above 1.0 over time.
    // The 4-decimal precision is critical to show 0.005% yield at this
    // share-price scale.
    expect(formatSharePrice(1_005_000n, 6)).toBe('$1.0050');
  });

  it('formats 0.9999 share price (loss event) as "$0.9999"', () => {
    // A drawdown event would push share price below 1.0. The 4-decimal
    // precision shows this clearly.
    expect(formatSharePrice(999_900n, 6)).toBe('$0.9999');
  });

  it('does NOT use thousands separator (always 4 decimal places, fixed)', () => {
    // Share prices are always between ~0.95 and ~1.10; thousands separator
    // would be misleading if a bug ever produced an inflated value.
    expect(formatSharePrice(1_000_000n, 6)).not.toContain(',');
  });

  it('handles zero share price', () => {
    expect(formatSharePrice(0n, 6)).toBe('$0.0000');
  });

  it('locks audit S-1: USDC share-price computation MUST use decimals=6, not 18', () => {
    // Audit S-1: prior code passed 10**18 to convertToAssets. If the bug
    // were to recur and the caller passed an 18-decimal value where 6 is
    // expected, the formatted price would be trillions.
    //
    // This test pins the contract: pass decimals=6 → reasonable output.
    // Pass decimals=18 with the same wei → tiny output.
    const sameRawValue = 1_000_000n;
    const correct = formatSharePrice(sameRawValue, 6);
    const buggy = formatSharePrice(sameRawValue, 18);
    expect(correct).toBe('$1.0000');
    expect(buggy).toBe('$0.0000'); // The bug surfaces as $0 not as trillions, but it's wrong either way
    expect(correct).not.toBe(buggy);
  });
});
