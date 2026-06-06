import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * /api/feedback requires a verified SIWE session (broken-auth fix: the old
 * check looked at the wrong cookie name and only tested existence). These tests
 * pin the auth gate + input validation.
 */

const getSessionMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-session', () => ({ getSession: getSessionMock }));

import { POST } from './route';

const SESSION = { walletAddress: '0x6821e3360d686a11b73afab4e3bc258fe7cc4a76' };

function jsonReq(body: unknown): Request {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getSessionMock.mockReset();
  vi.stubEnv('FEEDBACK_WEBHOOK_URL', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/feedback, anonymous posting', () => {
  it('accepts feedback with no session (the form posts anonymously; abuse is bounded by the per-IP rate limit)', async () => {
    getSessionMock.mockResolvedValue(null);
    const r = await POST(jsonReq({ category: 'bug', message: 'something is broken' }) as never);
    expect(r.status).toBe(200);
    expect((await r.json()).ok).toBe(true);
  });
});

describe('POST /api/feedback, validation (authenticated)', () => {
  beforeEach(() => getSessionMock.mockResolvedValue(SESSION));

  it('400 invalid_body on non-JSON with a JSON content-type', async () => {
    const r = await POST(jsonReq('not-json') as never);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('invalid_body');
  });

  it('400 invalid_category on an unknown category', async () => {
    const r = await POST(jsonReq({ category: 'spam', message: 'hello there' }) as never);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('invalid_category');
  });

  it('400 when the message is too short', async () => {
    const r = await POST(jsonReq({ category: 'bug', message: 'hi' }) as never);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/5-2000/);
  });

  it('400 when the message is too long', async () => {
    const r = await POST(jsonReq({ category: 'ux', message: 'x'.repeat(2001) }) as never);
    expect(r.status).toBe(400);
  });

  it('400 invalid_email on a malformed email', async () => {
    const r = await POST(jsonReq({ category: 'feature', message: 'add dark mode please', email: 'not-an-email' }) as never);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('invalid_email');
  });

  it('200 ok on a valid submission (no email)', async () => {
    const r = await POST(jsonReq({ category: 'bug', message: 'the chart does not render' }) as never);
    expect(r.status).toBe(200);
    expect((await r.json()).ok).toBe(true);
  });

  it('200 ok on a valid submission with a well-formed email', async () => {
    const r = await POST(jsonReq({ category: 'other', message: 'great product so far', email: 'a@b.co' }) as never);
    expect(r.status).toBe(200);
    expect((await r.json()).ok).toBe(true);
  });
});
