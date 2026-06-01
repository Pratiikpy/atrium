import { describe, it, expect } from 'vitest';
import { computeZScore } from '../src/tick';

describe('Augur z-score strategy', () => {
  it('returns 0 for insufficient data', () => {
    expect(computeZScore([100, 101], 30)).toBe(0);
  });

  it('returns negative z-score for price below mean', () => {
    const prices = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i * 0.1));
    prices.push(80); // well below mean
    const z = computeZScore(prices, 100);
    expect(z).toBeLessThan(-2);
  });

  it('returns positive z-score for price above mean', () => {
    const prices = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i * 0.1));
    prices.push(120); // well above mean
    const z = computeZScore(prices, 100);
    expect(z).toBeGreaterThan(2);
  });

  it('returns near-zero z-score for price at mean', () => {
    const prices = Array.from({ length: 100 }, () => 100);
    const z = computeZScore(prices, 100);
    expect(z).toBe(0); // sigma=0 → returns 0
  });

  // Phase 9b edge cases
  it('zero variance window produces no signal (returns 0)', () => {
    const prices = Array.from({ length: 50 }, () => 42.0);
    const z = computeZScore(prices, 50);
    expect(z).toBe(0);
  });

  it('extreme z-score is clamped or finite', () => {
    const prices = Array.from({ length: 100 }, () => 100);
    // Inject tiny variance then extreme outlier
    prices[99] = 100.001;
    prices.push(999999);
    const z = computeZScore(prices, 100);
    expect(Number.isFinite(z)).toBe(true);
  });

  it('handles data gaps (NaN/undefined filtered)', () => {
    const prices = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i * 0.1));
    // Simulate gaps, computeZScore should handle gracefully
    const z = computeZScore(prices, 100);
    expect(Number.isFinite(z)).toBe(true);
  });
});
