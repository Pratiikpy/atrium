import { describe, it, expect } from 'vitest';
import { arbiscanTxUrl, isValidTxHash } from './arbiscan';

/**
 * Iter 72 audit fix: pins the QQ-1 hash-validation contract on
 * arbiscanTxUrl + isValidTxHash. Pre-iter-72 zero tests pinned the
 * regex despite 6+ consumers across the app.
 *
 * QQ-1: tx hashes from any source (wagmi receipt, Scribe-indexed
 * event, mock data, API echo) get interpolated into Arbiscan URLs.
 * A malformed hash like `not-a-hash/extra/path` would inject path
 * components. Centralized validation rejects anything that doesn't
 * match `^0x[0-9a-fA-F]{64}$`.
 */

const VALID = '0x' + 'a'.repeat(64);

describe('isValidTxHash — regex gate', () => {
  it('accepts a canonical 0x-prefixed 64-hex string', () => {
    expect(isValidTxHash(VALID)).toBe(true);
    expect(isValidTxHash('0x' + 'F'.repeat(64))).toBe(true);
    expect(isValidTxHash('0x' + '0'.repeat(64))).toBe(true);
  });

  it('rejects null / undefined / non-string', () => {
    expect(isValidTxHash(null)).toBe(false);
    expect(isValidTxHash(undefined)).toBe(false);
    // @ts-expect-error testing runtime input
    expect(isValidTxHash(12345)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidTxHash('')).toBe(false);
  });

  it('rejects missing 0x prefix', () => {
    expect(isValidTxHash('a'.repeat(64))).toBe(false);
  });

  it('rejects wrong hex length (63)', () => {
    expect(isValidTxHash('0x' + 'a'.repeat(63))).toBe(false);
  });

  it('rejects wrong hex length (65)', () => {
    expect(isValidTxHash('0x' + 'a'.repeat(65))).toBe(false);
  });

  it('rejects non-hex character', () => {
    expect(isValidTxHash('0x' + 'a'.repeat(63) + 'Z')).toBe(false);
  });

  it('rejects path-injection attempts', () => {
    // The QQ-1 attack surface: callers interpolate into Arbiscan URLs.
    expect(isValidTxHash('0xaaa/../../../etc/passwd')).toBe(false);
    expect(isValidTxHash('0x' + 'a'.repeat(60) + '/x')).toBe(false);
  });
});

describe('arbiscanTxUrl — URL composition', () => {
  it('returns sepolia URL by default', () => {
    expect(arbiscanTxUrl(VALID)).toBe(`https://sepolia.arbiscan.io/tx/${VALID}`);
  });

  it('returns mainnet URL when network=mainnet', () => {
    expect(arbiscanTxUrl(VALID, 'mainnet')).toBe(`https://arbiscan.io/tx/${VALID}`);
  });

  it('returns null on invalid hash', () => {
    expect(arbiscanTxUrl('not-a-hash')).toBeNull();
    expect(arbiscanTxUrl(null)).toBeNull();
    expect(arbiscanTxUrl('')).toBeNull();
    expect(arbiscanTxUrl('0xshort')).toBeNull();
  });

  it('refuses to render a URL for a path-injection input', () => {
    // QQ-1 load-bearing assertion: the regex gate prevents the
    // returned URL from containing the attacker-supplied suffix.
    expect(arbiscanTxUrl('0x' + 'a'.repeat(60) + '/extra')).toBeNull();
  });

  it('uppercase hex passes the regex (case-insensitive)', () => {
    const upper = '0x' + 'A'.repeat(64);
    expect(arbiscanTxUrl(upper)).toBe(`https://sepolia.arbiscan.io/tx/${upper}`);
  });
});
