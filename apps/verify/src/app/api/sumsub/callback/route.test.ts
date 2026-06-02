import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';

/**
 * /api/sumsub/callback is a webhook that, on a GREEN KYC decision, signs an
 * on-chain Edict.assignTier. The trust boundary is the HMAC-SHA256 signature:
 * a spoofed or replayed webhook must be rejected BEFORE any tier assignment.
 * These tests compute real HMACs so a forged/tampered body genuinely fails the
 * timing-safe compare.
 */

const SECRET = 'sumsub-webhook-secret-' + 'z'.repeat(24);

function sign(rawBody: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

import { POST } from './route';

function req(rawBody: string, digest: string | null): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (digest !== null) headers['x-payload-digest'] = digest;
  return new Request('http://localhost/api/sumsub/callback', { method: 'POST', headers, body: rawBody });
}

beforeEach(() => {
  vi.stubEnv('SUMSUB_WEBHOOK_SECRET', SECRET);
  // No on-chain key/addr -> route stops at the honest "deferred" branch before
  // touching viem, which keeps these tests pure.
  vi.stubEnv('PRAETOR_MULTISIG_KEY', '');
  vi.stubEnv('EDICT_CONTRACT_ADDR', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/sumsub/callback, signature gate', () => {
  it('503 when SUMSUB_WEBHOOK_SECRET is not provisioned', async () => {
    vi.stubEnv('SUMSUB_WEBHOOK_SECRET', '');
    const body = JSON.stringify({ type: 'ping' });
    const r = await POST(req(body, sign(body)) as never);
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('sumsub_not_configured');
  });

  it('401 when the signature header is missing', async () => {
    const body = JSON.stringify({ type: 'applicantReviewed' });
    const r = await POST(req(body, null) as never);
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe('invalid_signature');
  });

  it('401 on a forged signature', async () => {
    const body = JSON.stringify({ type: 'applicantReviewed' });
    const r = await POST(req(body, 'de'.repeat(32)) as never);
    expect(r.status).toBe(401);
  });

  it('401 on a tampered body (signature was computed over a different payload)', async () => {
    const signedBody = JSON.stringify({ type: 'applicantReviewed', applicantId: 'A' });
    const tamperedBody = JSON.stringify({ type: 'applicantReviewed', applicantId: 'EVIL' });
    const r = await POST(req(tamperedBody, sign(signedBody)) as never);
    expect(r.status).toBe(401);
  });
});

describe('POST /api/sumsub/callback, event handling (valid signature)', () => {
  async function post(payload: object) {
    const body = JSON.stringify(payload);
    return POST(req(body, sign(body)) as never);
  }

  it('400 invalid_json when the signed body is not JSON', async () => {
    const raw = 'not-json';
    const r = await POST(req(raw, sign(raw)) as never);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('invalid_json');
  });

  it('ignores non-applicantReviewed events', async () => {
    const r = await post({ type: 'applicantPending', applicantId: 'a1' });
    expect(r.status).toBe(200);
    expect((await r.json()).ignored).toBe('applicantPending');
  });

  it('ignores a non-GREEN review without assigning a tier', async () => {
    const r = await post({ type: 'applicantReviewed', applicantId: 'a1', reviewResult: { reviewAnswer: 'RED', rejectLabels: ['FORGERY'] } });
    expect(r.status).toBe(200);
    expect((await r.json()).ignored).toBe('review_not_green');
  });

  it('400 invalid_external_user_id when GREEN but externalUserId is not a wallet', async () => {
    const r = await post({ type: 'applicantReviewed', applicantId: 'a1', externalUserId: 'not-a-wallet', reviewResult: { reviewAnswer: 'GREEN' } });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('invalid_external_user_id');
  });

  it('defers (does not throw) when GREEN + valid wallet but praetor/Edict not configured', async () => {
    const wallet = '0x' + 'a'.repeat(40);
    const r = await post({ type: 'applicantReviewed', applicantId: 'a1', externalUserId: wallet, reviewResult: { reviewAnswer: 'GREEN' } });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.warning).toMatch(/deferred/);
    expect(j.wallet).toBe(wallet);
  });
});
