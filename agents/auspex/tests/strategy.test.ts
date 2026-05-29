import { describe, it, expect } from 'vitest';
import { computeBasisSignal } from '../src/tick';

describe('Auspex basis-trade strategy', () => {
  it('enters when funding > yield + 200bps', () => {
    expect(computeBasisSignal(700, 400)).toBe('enter');
  });

  it('holds when spread is positive but < 200bps', () => {
    expect(computeBasisSignal(550, 400)).toBe('hold');
  });

  it('closes when funding < yield (negative spread)', () => {
    expect(computeBasisSignal(300, 400)).toBe('close');
  });

  it('holds at exactly 200bps spread', () => {
    expect(computeBasisSignal(600, 400)).toBe('hold');
  });

  it('enters at 201bps spread', () => {
    expect(computeBasisSignal(601, 400)).toBe('enter');
  });

  // Phase 9b edge cases
  it('funding rate flip mid-position triggers close', () => {
    // If funding was positive (enter) but flips negative → close
    expect(computeBasisSignal(-100, 400)).toBe('close');
  });

  it('spread inversion (negative funding, positive yield) → close', () => {
    expect(computeBasisSignal(-50, 200)).toBe('close');
  });

  it('zero funding rate with positive yield → close', () => {
    expect(computeBasisSignal(0, 400)).toBe('close');
  });
});
