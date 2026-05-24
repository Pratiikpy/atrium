import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTsOrNull, ago } from './format-time';

/**
 * Iter 72 audit fix: pins the strict-numeric parse + ago()
 * formatting that 6+ routes depend on. Pre-iter-72 the helper had
 * no tests despite being load-bearing for activity / notifications
 * / portfolio / reserves clusters.
 *
 * The Wave-KK / II-1 invariants:
 *   - parseTsOrNull rejects every non-canonical input shape and
 *     returns null so callers can drop the row deterministically.
 *   - ago() clamps at 0 so clock-skew doesn't render "-5s ago".
 *   - ago() crosses unit boundaries at 60/3600/86400 (the canonical
 *     s/m/h/d breakpoints).
 */

describe('parseTsOrNull — strict numeric parse', () => {
  it('rejects null', () => {
    expect(parseTsOrNull(null)).toBeNull();
  });
  it('rejects undefined', () => {
    expect(parseTsOrNull(undefined)).toBeNull();
  });
  it('rejects empty string', () => {
    expect(parseTsOrNull('')).toBeNull();
  });
  it('rejects pure text', () => {
    expect(parseTsOrNull('NaN')).toBeNull();
    expect(parseTsOrNull('undefined')).toBeNull();
    expect(parseTsOrNull('abc')).toBeNull();
  });
  it('rejects trailing garbage (parseInt would accept)', () => {
    // parseInt("123abc", 10) returns 123 — that's the lenient bug
    // II-1 guards against.
    expect(parseTsOrNull('123abc')).toBeNull();
  });
  it('rejects leading sign', () => {
    expect(parseTsOrNull('+100')).toBeNull();
    expect(parseTsOrNull('-100')).toBeNull();
  });
  it('rejects scientific notation', () => {
    expect(parseTsOrNull('1e10')).toBeNull();
  });
  it('rejects decimal point', () => {
    expect(parseTsOrNull('123.456')).toBeNull();
  });
  it('rejects hex prefix', () => {
    expect(parseTsOrNull('0x100')).toBeNull();
  });
  it('rejects implausibly large values (year 9999+ boundary)', () => {
    // 253_402_300_799 = ~year 9999. Anything larger rejected.
    expect(parseTsOrNull('253402300800')).toBeNull();
    expect(parseTsOrNull('999999999999')).toBeNull();
  });
  it('accepts the year-9999 boundary value', () => {
    expect(parseTsOrNull('253402300799')).toBe(253_402_300_799);
  });
  it('accepts zero (epoch)', () => {
    expect(parseTsOrNull('0')).toBe(0);
  });
  it('accepts a canonical unix-seconds value', () => {
    expect(parseTsOrNull('1700000000')).toBe(1_700_000_000);
  });
});

describe('ago — unit breakpoints', () => {
  const fixedNow = 1_700_000_000; // unix seconds

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow * 1000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 0s ago at exactly now', () => {
    expect(ago(fixedNow)).toBe('0s ago');
  });
  it('renders s for diff < 60', () => {
    expect(ago(fixedNow - 5)).toBe('5s ago');
    expect(ago(fixedNow - 59)).toBe('59s ago');
  });
  it('crosses to m at 60s', () => {
    expect(ago(fixedNow - 60)).toBe('1m ago');
    expect(ago(fixedNow - 120)).toBe('2m ago');
  });
  it('renders m for diff < 3600', () => {
    expect(ago(fixedNow - 1799)).toBe('29m ago');
    expect(ago(fixedNow - 3599)).toBe('59m ago');
  });
  it('crosses to h at 3600s', () => {
    expect(ago(fixedNow - 3600)).toBe('1h ago');
    expect(ago(fixedNow - 7200)).toBe('2h ago');
  });
  it('renders h for diff < 86400', () => {
    expect(ago(fixedNow - 86399)).toBe('23h ago');
  });
  it('crosses to d at 86400s', () => {
    expect(ago(fixedNow - 86400)).toBe('1d ago');
    expect(ago(fixedNow - 86400 * 7)).toBe('7d ago');
  });
  it('clamps negative diff to 0 (clock skew)', () => {
    // ago() of a FUTURE timestamp would otherwise return "-5s ago".
    // The Math.max(0, ...) guard renders "0s ago" honestly.
    expect(ago(fixedNow + 100)).toBe('0s ago');
  });
});
