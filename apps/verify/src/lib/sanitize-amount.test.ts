import { describe, it, expect } from 'vitest';
import { sanitizeAmount } from './sanitize-amount';

describe('sanitizeAmount', () => {
  it('strips letters', () => expect(sanitizeAmount('abc')).toBe(''));
  it('strips the minus sign', () => expect(sanitizeAmount('-5')).toBe('5'));
  it('strips whitespace', () => expect(sanitizeAmount('  ')).toBe(''));
  it('strips commas (thousands separators)', () => expect(sanitizeAmount('1,000')).toBe('1000'));
  it('keeps a plain integer', () => expect(sanitizeAmount('12')).toBe('12'));
  it('keeps a single decimal', () => expect(sanitizeAmount('12.34')).toBe('12.34'));
  it('keeps a trailing dot (mid-typing)', () => expect(sanitizeAmount('1.')).toBe('1.'));
  it('keeps a leading dot', () => expect(sanitizeAmount('.5')).toBe('.5'));
  it('keeps full 6-decimal USDC precision', () => expect(sanitizeAmount('12.345678')).toBe('12.345678'));
  // the bug this fixes: multiple decimal points are collapsed to the first
  it('drops a second decimal point', () => expect(sanitizeAmount('1.2.3')).toBe('1.23'));
  it('drops all decimals after the first', () => expect(sanitizeAmount('1.2.3.4')).toBe('1.234'));
  it('handles a mix of junk and extra dots', () => expect(sanitizeAmount('a1b.2c.3')).toBe('1.23'));
});
