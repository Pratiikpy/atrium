import { describe, it, expect } from 'vitest';
import { parseAumUsd } from './leaderboard';

/**
 * Locks the compact-USD parser used by the leaderboard's sort-by-AUM
 * comparator. Once Rostrum data lands and the leaderboard renders real
 * rows, the sort tabs (P&L / Sharpe / AUM) must order AUM strings
 * correctly, `"$1.2M"` should sort above `"$840K"`, not below it as
 * a lexicographic string sort would do.
 */
describe('parseAumUsd', () => {
  it('parses dollars without suffix', () => {
    expect(parseAumUsd('$1234')).toBe(1234);
    expect(parseAumUsd('$1,234')).toBe(1234);
  });

  it('parses K / M / B suffixes case-insensitively', () => {
    expect(parseAumUsd('$840K')).toBe(840_000);
    expect(parseAumUsd('$840k')).toBe(840_000);
    expect(parseAumUsd('$1.2M')).toBe(1_200_000);
    expect(parseAumUsd('$3.5B')).toBe(3_500_000_000);
  });

  it('returns 0 on garbage strings rather than NaN', () => {
    expect(parseAumUsd('')).toBe(0);
    expect(parseAumUsd('--')).toBe(0);
    expect(parseAumUsd('pending')).toBe(0);
    expect(parseAumUsd('$abc')).toBe(0);
  });

  it('orders correctly when used as a sort comparator', () => {
    const xs = ['$840K', '$1.2M', '$73.2K', '$3.5B', '$15M'];
    const sorted = xs.slice().sort((a, b) => parseAumUsd(b) - parseAumUsd(a));
    expect(sorted).toEqual(['$3.5B', '$15M', '$1.2M', '$840K', '$73.2K']);
  });

  it('handles negative-AUM strings (corner case for sort stability)', () => {
    expect(parseAumUsd('$-100')).toBe(-100);
    expect(parseAumUsd('$-1.5M')).toBe(-1_500_000);
  });

  it('sinks unparseable strings to the end when sorted descending', () => {
    const xs = ['$840K', 'pending', '$1.2M', ''];
    const sorted = xs.slice().sort((a, b) => parseAumUsd(b) - parseAumUsd(a));
    expect(sorted[0]).toBe('$1.2M');
    expect(sorted[1]).toBe('$840K');
    // 'pending' and '' both → 0, so they're at the end (order between them
    // depends on stable sort behavior).
  });
});
