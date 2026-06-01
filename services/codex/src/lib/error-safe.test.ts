import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Iter 73 cleanup: codex package.json's @x402/* deps were dead (zero imports
// in src/) and pinned to a never-published 0.4.x version, blocking install.
// Removed those deps; vitest now runs from services/codex/ directly.
import { safeErrorDetail } from './error-safe';

/**
 * Iter 73 audit fix: pins the FIRE78-CODEX1 redaction contract on
 * the Codex-side safeErrorDetail. Sister to the verify-app
 * safe-error.test.ts but with the env-shape that Cloudflare Workers
 * uses (`env.ENV` instead of `process.env.NODE_ENV`).
 *
 * Threat model: a Codex route's catch block forwards err.message
 * to the client. Stack traces leak D1 query parameters, RPC
 * endpoints, env-var presence. In production: static fallback.
 * In dev: pass through for debugging. Server always logs the full
 * error.
 */

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleSpy.mockRestore();
});

describe('Codex safeErrorDetail, production redaction', () => {
  it('returns static fallback in production (NOT err.message)', () => {
    const err = new Error('D1 SELECT failed: tx_hash=0xLEAKY rpc=https://leak.example.com');
    expect(safeErrorDetail(err, { ENV: 'production' })).toBe('upstream unavailable');
  });

  it('still logs the raw error server-side in production', () => {
    const err = new Error('secret');
    safeErrorDetail(err, { ENV: 'production' });
    expect(consoleSpy).toHaveBeenCalled();
    const args = consoleSpy.mock.calls[0];
    expect(String(args[1])).toContain('secret');
  });
});

describe('Codex safeErrorDetail, dev pass-through', () => {
  it('returns err.message when env.ENV is undefined (dev default)', () => {
    const err = new Error('Scribe 503');
    expect(safeErrorDetail(err, {})).toBe('Scribe 503');
  });

  it('returns err.message when env.ENV is "development"', () => {
    const err = new Error('test detail');
    expect(safeErrorDetail(err, { ENV: 'development' })).toBe('test detail');
  });

  it('returns "unknown error" fallback when err lacks message', () => {
    expect(safeErrorDetail(null, { ENV: 'development' })).toBe('unknown error');
    expect(safeErrorDetail(undefined, { ENV: 'development' })).toBe('unknown error');
  });
});

describe('Codex safeErrorDetail, env-shape mismatch tolerance', () => {
  it('treats env=null as non-production (dev pass-through)', () => {
    // Defensive: a Worker that hasn't bound ENV must NOT fall to the
    // "production" branch by accident. Default-to-dev keeps debug
    // visibility for unconfigured deploys.
    const err = new Error('detail');
    expect(safeErrorDetail(err, null as any)).toBe('detail');
  });

  it('treats env.ENV="staging" as non-production (only "production" literal redacts)', () => {
    const err = new Error('staging detail');
    // Cloudflare Workers convention: only the literal "production"
    // triggers redaction. Staging / preview stay verbose for ops.
    expect(safeErrorDetail(err, { ENV: 'staging' })).toBe('staging detail');
  });

  it('handles non-Error thrown values gracefully', () => {
    expect(() => safeErrorDetail('a bare string', { ENV: 'production' })).not.toThrow();
    expect(() => safeErrorDetail({ foo: 'bar' }, { ENV: 'production' })).not.toThrow();
    // Production path always returns the static fallback.
    expect(safeErrorDetail('bare', { ENV: 'production' })).toBe('upstream unavailable');
  });
});
