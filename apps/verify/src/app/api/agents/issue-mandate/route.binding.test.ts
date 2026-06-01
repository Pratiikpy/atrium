import { describe, it, expect, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { hashTypedData, parseUnits } from 'viem';
import { buildSigilTypedData, type IntentSigilEnvelope } from '@/lib/sigil-typed-data';
import { instrumentIdsForVenues } from '@/lib/instruments';

/**
 * Locks the 2026-05-29 signature-binding fix on /api/agents/issue-mandate.
 *
 * Pre-fix the route recovered the signer from the CLIENT-supplied intentHash,
 * so the signature never bound to the mandate fields, a caller could post
 * arbitrary fields with a signature over an unrelated hash and pass. The fix
 * recomputes the EIP-712 struct hash server-side from the validated fields +
 * the canonical domain (chainId 421614 + deployed Sigil address), recovers
 * from THAT hash, and rejects on mismatch. These tests sign with a real test
 * key and prove: a clean mandate is accepted, and tampering any field after
 * signing is rejected.
 */

// Well-known test private key (Anvil account #1), NOT a real-funds key.
const TEST_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const account = privateKeyToAccount(TEST_PK);
const SIGIL = ('0x' + 'c9'.repeat(20)) as `0x${string}`;
const CHAIN = 421614;
const USDC = 6;

// Session = the signing wallet; Sigil resolves to a fixed test address.
vi.mock('@/lib/auth-session', () => ({
  getSession: async () => ({ walletAddress: account.address.toLowerCase() }),
}));
vi.mock('@/lib/deployments-registry', () => ({
  loadContractAddress: vi.fn(async () => SIGIL),
}));

import { POST } from './route';

const FORM = {
  agent: ('0x' + 'a'.repeat(40)) as `0x${string}`,
  perActionCapUsdc: 50,
  totalOpenCapUsdc: 500,
  actionsPerDay: 24,
  expiresDays: 14,
  venueAllowlist: ['hyperliquid', 'aave-horizon'],
};

async function buildSigned(
  form: typeof FORM = FORM,
  expiresAt?: bigint,
  nonce = 12345n,
) {
  const exp = expiresAt ?? BigInt(Math.floor(Date.now() / 1000) + 14 * 86_400);
  const envelope: IntentSigilEnvelope = {
    owner: account.address,
    agent: form.agent,
    venuesAllowedIds: form.venueAllowlist,
    // 062-FE7: instruments are derived from the venue allowlist (same as the
    // hook + server recompute). An empty list would both fail the server hash
    // match and brick the mandate on-chain.
    instrumentsAllowed: instrumentIdsForVenues(form.venueAllowlist),
    maxNotionalPerActionWei: parseUnits(String(form.perActionCapUsdc), USDC),
    maxTotalOpenNotionalWei: parseUnits(String(form.totalOpenCapUsdc), USDC),
    maxActionsPer24h: form.actionsPerDay,
    expiresAt: exp,
    nonce,
    agentRevocationNonceAtSigning: 0n,
  };
  const typedData = buildSigilTypedData(envelope, CHAIN, SIGIL);
  // viem's local-account signer + hasher accept the {domain,types,primaryType,message} shape.
  const signature = await account.signTypedData(typedData as never);
  const intentHash = hashTypedData(typedData as never);
  return { signature, intentHash, expiresAt: exp, nonce };
}

function req(body: unknown): Request {
  return new Request('http://localhost/api/agents/issue-mandate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  });
}

describe('issue-mandate signature binding', () => {
  it('accepts a correctly-signed mandate and echoes the server-recomputed hash', async () => {
    const { signature, intentHash, expiresAt, nonce } = await buildSigned();
    const res = await POST(
      req({ ...FORM, signature, intentHash, expiresAt: expiresAt.toString(), nonce: nonce.toString() }) as never,
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect((j.mandate.intentHash as string).toLowerCase()).toBe(intentHash.toLowerCase());
  });

  it('rejects when a form field is tampered after signing (signature no longer binds)', async () => {
    const { signature, intentHash, expiresAt, nonce } = await buildSigned();
    // Signed for actionsPerDay=24; submit 48. Still passes the 1..1000 bound
    // check, so it reaches the signature stage, where the server recomputes a
    // different hash from the tampered field (max_actions_per_24h is in the
    // signed struct) and rejects. (A field that fails an earlier bound check,
    // e.g. an over-cap value, would 400 before this stage, also rejected,
    // just not on this path.)
    const res = await POST(
      req({ ...FORM, actionsPerDay: 48, signature, intentHash, expiresAt: expiresAt.toString(), nonce: nonce.toString() }) as never,
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('intent_hash_mismatch');
  });

  it('rejects a forged intentHash that does not match the mandate', async () => {
    const { signature, expiresAt, nonce } = await buildSigned();
    const fakeHash = ('0x' + 'de'.repeat(32)) as `0x${string}`;
    const res = await POST(
      req({ ...FORM, signature, intentHash: fakeHash, expiresAt: expiresAt.toString(), nonce: nonce.toString() }) as never,
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('intent_hash_mismatch');
  });

  it('rejects an already-expired mandate before recovery', async () => {
    const past = BigInt(Math.floor(Date.now() / 1000) - 60);
    const { signature, intentHash, nonce } = await buildSigned(FORM, past);
    const res = await POST(
      req({ ...FORM, signature, intentHash, expiresAt: past.toString(), nonce: nonce.toString() }) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('mandate already expired');
  });

  it('rejects a missing expiresAt/nonce on the signed path', async () => {
    const { signature, intentHash } = await buildSigned();
    const res = await POST(req({ ...FORM, signature, intentHash }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/expiresAt|nonce/);
  });
});
