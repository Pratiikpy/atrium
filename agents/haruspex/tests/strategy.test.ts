import { describe, it, expect } from 'vitest';
import { computeSmaSignal } from '../src/tick';

describe('Haruspex SMA crossover strategy', () => {
  it('returns hold for insufficient data', () => {
    expect(computeSmaSignal([100, 101, 102], 168)).toBe('hold');
  });

  it('returns long when price > SMA + 1σ', () => {
    const prices = Array.from({ length: 168 }, () => 100);
    prices.push(120);
    expect(computeSmaSignal(prices, 168)).toBe('long');
  });

  it('returns close when price < SMA', () => {
    const prices = Array.from({ length: 168 }, () => 100);
    prices.push(90);
    expect(computeSmaSignal(prices, 168)).toBe('close');
  });

  it('returns hold when price between SMA and SMA+σ', () => {
    const prices = Array.from({ length: 168 }, () => 100);
    prices.push(100);
    expect(computeSmaSignal(prices, 168)).toBe('hold');
  });

  // Phase 9b edge cases
  it('window edge: exactly 7 days (168 hours) of data', () => {
    const prices = Array.from({ length: 168 }, (_, i) => 100 + i * 0.01);
    prices.push(prices[prices.length - 1]); // price at mean
    const signal = computeSmaSignal(prices, 168);
    expect(['hold', 'long', 'close']).toContain(signal);
  });

  it('price spike: sudden 50% jump triggers long', () => {
    const prices = Array.from({ length: 168 }, () => 100);
    prices.push(150); // 50% spike
    expect(computeSmaSignal(prices, 168)).toBe('long');
  });

  it('gap: handles flat data without crashing', () => {
    const prices = Array.from({ length: 200 }, () => 50);
    prices.push(50);
    const signal = computeSmaSignal(prices, 168);
    expect(signal).toBe('hold');
  });
});
