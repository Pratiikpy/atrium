import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SiweMessage } from 'siwe';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Security-critical: /api/auth/verify is the SIWE trust boundary. A forged or
 * replayed signature accepted here is account takeover. These tests sign REAL
 * SIWE messages with throwaway test keys and let viem's REAL ECDSA recovery run
 * (only the network transport is stubbed), so a forged signature genuinely
 * fails recovery rather than a mock returning false.
 *
 * Not covered here: the EIP-1271 smart-contract-wallet (Postern) path, which
 * needs a live RPC eth_call against a deployed account. That is exercised in
 * the wallet E2E, not in unit tests.
 */

// Controllable cookie jar shared with the next/headers mock.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
}));

// Real ECDSA recovery, no network. verifyMessage returns true only when the
// signature actually recovers to the claimed address.
vi.mock('viem', async () => {
  const real = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...real,
    http: vi.fn(() => ({})),
    createPublicClient: vi.fn(() => ({
      verifyMessage: async ({ address, message, signature }: { address: string; message: string; signature: string }) => {
        const recovered = await real.recoverMessageAddress({ message, signature: signature as `0x${string}` });
        return recovered.toLowerCase() === String(address).toLowerCase();
      },
    })),
  };
});

import { POST } from './route';

// Anvil accounts #0 and #1: well-known test keys, NOT real-funds keys.
const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const attacker = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');

const NONCE = 'abcdef0123456789';
const SECRET = 'test-session-secret-' + 'x'.repeat(32);

function buildMessage(overrides: Partial<{
  domain: string; address: string; uri: string; nonce: string; issuedAt: string; expirationTime: string;
}> = {}): string {
  const msg = new SiweMessage({
    domain: overrides.domain ?? 'localhost',
    address: overrides.address ?? account.address,
    statement: 'Sign in to Atrium',
    uri: overrides.uri ?? 'http://localhost/',
    version: '1',
    chainId: 421614,
    nonce: overrides.nonce ?? NONCE,
    issuedAt: overrides.issuedAt ?? new Date().toISOString(),
    ...(overrides.expirationTime ? { expirationTime: overrides.expirationTime } : {}),
  });
  return msg.prepareMessage();
}

function req(body: unknown): Request {
  return new Request('http://localhost/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  jar.clear();
  vi.stubEnv('ATRIUM_SESSION_SECRET', SECRET);
  vi.stubEnv('ATRIUM_AUTH_HOST', 'localhost');
  vi.stubEnv('NODE_ENV', 'test');
});
afterEach(() => {
  vi.unstubAllEnvs();
  jar.clear();
});

describe('POST /api/auth/verify, negative matrix', () => {
  it('400 invalid_body on a non-JSON body', async () => {
    jar.set('atrium-nonce', NONCE);
    const r = await POST(req('not-json') as never);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('invalid_body');
  });

  it('401 nonce_expired when no nonce cookie was issued', async () => {
    const r = await POST(req({ message: buildMessage(), signature: '0x00' }) as never);
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe('nonce_expired');
  });

  it('401 domain_mismatch when the signed domain is not our host (phishing clone)', async () => {
    jar.set('atrium-nonce', NONCE);
    const r = await POST(req({ message: buildMessage({ domain: 'evil.example' }), signature: '0x00' }) as never);
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe('domain_mismatch');
  });

  it('401 uri_mismatch when the signed uri points off-host', async () => {
    jar.set('atrium-nonce', NONCE);
    const r = await POST(req({ message: buildMessage({ uri: 'http://evil.example/' }), signature: '0x00' }) as never);
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe('uri_mismatch');
  });

  it('401 nonce_mismatch when the signed nonce != the issued nonce (replay/foreign)', async () => {
    jar.set('atrium-nonce', NONCE);
    const r = await POST(req({ message: buildMessage({ nonce: 'ffffffff00000000' }), signature: '0x00' }) as never);
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe('nonce_mismatch');
  });

  it('401 message_expired when the SIWE expirationTime is in the past', async () => {
    jar.set('atrium-nonce', NONCE);
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const older = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const r = await POST(req({ message: buildMessage({ issuedAt: older, expirationTime: past }), signature: '0x00' }) as never);
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe('message_expired');
  });

  it('401 verification_failed on a forged signature (recovers to a different address)', async () => {
    jar.set('atrium-nonce', NONCE);
    const message = buildMessage(); // message claims account.address
    const signature = await attacker.signMessage({ message }); // but the attacker signed it
    const r = await POST(req({ message, signature }) as never);
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe('verification_failed');
    // a rejected sign-in must NOT mint a session
    expect(jar.has('atrium-session')).toBe(false);
  });

  it('500 host_unknown when neither ATRIUM_AUTH_HOST nor a Host header resolves', async () => {
    vi.stubEnv('ATRIUM_AUTH_HOST', '');
    jar.set('atrium-nonce', NONCE);
    const r = await POST(req({ message: buildMessage(), signature: '0x00' }) as never);
    expect(r.status).toBe(500);
    expect((await r.json()).error).toBe('host_unknown');
  });
});

describe('POST /api/auth/verify, happy path', () => {
  it('200 + mints a session and consumes the single-use nonce on a valid signature', async () => {
    jar.set('atrium-nonce', NONCE);
    const message = buildMessage();
    const signature = await account.signMessage({ message });
    const r = await POST(req({ message, signature }) as never);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.walletAddress).toBe(account.address.toLowerCase());
    expect(jar.get('atrium-session')).toBeTruthy();
    expect(jar.has('atrium-nonce')).toBe(false); // nonce burned
  });
});
