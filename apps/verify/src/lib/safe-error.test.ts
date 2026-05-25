import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeErrorDetail } from './safe-error';

/**
 * Iter 72 audit fix: pins the prod-vs-dev redaction contract on
 * safeErrorDetail. Pre-iter-72 zero tests pinned the behavior despite
 * 5+ consuming routes (lantern/*, tax/export, transfer/chain-balance,
 * chaos/inject).
 *
 * Contract:
 *   - In production (NODE_ENV === 'production'): return the static
 *     fallback, never the raw err.message — prevents leaking gateway
 *     URLs, RPC endpoints, library stack traces, env-var presence.
 *   - In dev / test: pass through err.message for fast debugging.
 *   - Always logs the full error server-side via console.error.
 *   - Tolerates non-Error inputs (strings, undefined, plain objects)
 *     without throwing.
 */

const ORIGINAL_ENV = process.env.NODE_ENV;
// NODE_ENV is typed read-only under @types/node 22+ but `process.env`
// itself is still a plain assignable object at runtime. Cast through
// Record to bypass the type-system constraint; behavior identical to
// the prior direct-assignment form.
function setEnv(value: string | undefined): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setEnv(ORIGINAL_ENV);
  consoleSpy.mockRestore();
});

describe('safeErrorDetail — production redaction', () => {
  it('returns the static fallback (NOT err.message) in production', () => {
    setEnv('production');
    const err = new Error('RPC at https://leaky.rpc.example.com failed');
    expect(safeErrorDetail(err)).toBe('upstream unavailable');
  });

  it('returns the explicit fallback override in production', () => {
    setEnv('production');
    const err = new Error('secret stack trace');
    expect(safeErrorDetail(err, 'scribe unreachable')).toBe('scribe unreachable');
  });

  it('still console.errors the raw error server-side in production', () => {
    setEnv('production');
    const err = new Error('RPC at https://leaky.rpc.example.com failed');
    safeErrorDetail(err);
    expect(consoleSpy).toHaveBeenCalled();
    // Server-side log captures the full stack — ops still has visibility.
    const callArgs = consoleSpy.mock.calls[0];
    expect(String(callArgs[1])).toContain('leaky.rpc.example.com');
  });
});

describe('safeErrorDetail — dev / test pass-through', () => {
  it('returns err.message in non-production', () => {
    setEnv('development');
    const err = new Error('Scribe 503 retry-after 5s');
    expect(safeErrorDetail(err)).toBe('Scribe 503 retry-after 5s');
  });

  it('returns err.message in test env', () => {
    setEnv('test');
    const err = new Error('test detail');
    expect(safeErrorDetail(err)).toBe('test detail');
  });

  it('falls back to default when err has no message (dev)', () => {
    setEnv('development');
    expect(safeErrorDetail(null)).toBe('upstream unavailable');
    expect(safeErrorDetail(undefined)).toBe('upstream unavailable');
  });

  it('uses explicit fallback when err has no message (dev)', () => {
    setEnv('development');
    expect(safeErrorDetail(null, 'tablet pending')).toBe('tablet pending');
  });
});

describe('safeErrorDetail — non-Error inputs', () => {
  it('does not throw on string input', () => {
    setEnv('development');
    expect(() => safeErrorDetail('a bare string')).not.toThrow();
  });

  it('does not throw on plain-object input', () => {
    setEnv('development');
    expect(() => safeErrorDetail({ foo: 'bar' })).not.toThrow();
  });
});
