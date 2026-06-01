import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Phase theta.2 fix verification. Pre-fix this route had NO auth: any
 * caller could GET another user's prefs (Telegram chat id, email,
 * webhook URL) or POST overwrite them. The Bearer-auth fix added a
 * constant-time comparison against ATRIUM_INTERNAL_KEY (or the legacy
 * NOTIFIER_INTERNAL_KEY fallback), these tests pin that contract.
 *
 * Coverage: 401 on missing header, 401 on wrong token, 503 on missing
 * env, success on the right token + valid wallet. The constant-time
 * comparison itself can't be observed from tests (that's a side-channel
 * property); we settle for "wrong token rejects, right token accepts".
 */

const originalAtrium = process.env.ATRIUM_INTERNAL_KEY;
const originalNotifier = process.env.NOTIFIER_INTERNAL_KEY;
const originalKvUrl = process.env.ATRIUM_KV_REST_URL;
const originalKvToken = process.env.ATRIUM_KV_REST_TOKEN;

const VALID_TOKEN = 'test-internal-key-' + 'a'.repeat(48);
const VALID_USER = '0x' + 'A'.repeat(40);

beforeEach(() => {
  process.env.ATRIUM_INTERNAL_KEY = VALID_TOKEN;
  delete process.env.NOTIFIER_INTERNAL_KEY;
  // Clear KV config so the path falls into the unconfigured branch -
  // that's enough to validate the auth gate without standing up a KV mock.
  delete process.env.ATRIUM_KV_REST_URL;
  delete process.env.ATRIUM_KV_REST_TOKEN;
  vi.resetModules();
});

afterEach(() => {
  if (originalAtrium === undefined) delete process.env.ATRIUM_INTERNAL_KEY;
  else process.env.ATRIUM_INTERNAL_KEY = originalAtrium;
  if (originalNotifier === undefined) delete process.env.NOTIFIER_INTERNAL_KEY;
  else process.env.NOTIFIER_INTERNAL_KEY = originalNotifier;
  if (originalKvUrl === undefined) delete process.env.ATRIUM_KV_REST_URL;
  else process.env.ATRIUM_KV_REST_URL = originalKvUrl;
  if (originalKvToken === undefined) delete process.env.ATRIUM_KV_REST_TOKEN;
  else process.env.ATRIUM_KV_REST_TOKEN = originalKvToken;
});

function makeRequest(headers: Record<string, string> = {}, body?: unknown): Request {
  return new Request(`http://localhost/api/settings/notifications?user=${VALID_USER}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/settings/notifications, Bearer auth', () => {
  it('returns 401 when no Authorization header', async () => {
    const { GET } = await import('./route');
    const r = await GET(makeRequest());
    expect(r.status).toBe(401);
    const j = await r.json();
    expect(j.error).toBe('unauthorized');
  });

  it('returns 401 when token is wrong', async () => {
    const { GET } = await import('./route');
    const r = await GET(makeRequest({ Authorization: 'Bearer wrong-token' }));
    expect(r.status).toBe(401);
  });

  it('returns 401 when scheme is not Bearer', async () => {
    const { GET } = await import('./route');
    const r = await GET(makeRequest({ Authorization: `Basic ${VALID_TOKEN}` }));
    expect(r.status).toBe(401);
  });

  it('returns 503 when ATRIUM_INTERNAL_KEY is unset (fail-closed)', async () => {
    delete process.env.ATRIUM_INTERNAL_KEY;
    const { GET } = await import('./route');
    const r = await GET(makeRequest({ Authorization: `Bearer ${VALID_TOKEN}` }));
    expect(r.status).toBe(503);
    const j = await r.json();
    expect(j.error).toBe('auth_not_configured');
  });

  it('accepts the legacy NOTIFIER_INTERNAL_KEY fallback', async () => {
    delete process.env.ATRIUM_INTERNAL_KEY;
    process.env.NOTIFIER_INTERNAL_KEY = VALID_TOKEN;
    const { GET } = await import('./route');
    const r = await GET(makeRequest({ Authorization: `Bearer ${VALID_TOKEN}` }));
    // 200 because KV is unconfigured → returns honest pending shape.
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.source).toBe('pending');
  });

  it('passes through to the route handler when the token matches', async () => {
    const { GET } = await import('./route');
    const r = await GET(makeRequest({ Authorization: `Bearer ${VALID_TOKEN}` }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.user).toBe(VALID_USER);
    expect(j.source).toBe('pending');
  });

  it('still validates wallet format AFTER auth passes', async () => {
    const { GET } = await import('./route');
    const r = await GET(
      new Request('http://localhost/api/settings/notifications?user=not-a-wallet', {
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
      }),
    );
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error).toBe('invalid_user');
  });
});

describe('POST /api/settings/notifications, Bearer auth', () => {
  const validBody = {
    user: VALID_USER,
    channels: [
      {
        kind: 'telegram' as const,
        enabled: true,
        telegramChatId: '12345',
        minSeverity: 'info' as const,
      },
    ],
    mutedKinds: [],
  };

  it('returns 401 when no Authorization header', async () => {
    const { POST } = await import('./route');
    const r = await POST(makeRequest({}, validBody));
    expect(r.status).toBe(401);
  });

  it('returns 401 when token is wrong', async () => {
    const { POST } = await import('./route');
    const r = await POST(makeRequest({ Authorization: 'Bearer nope' }, validBody));
    expect(r.status).toBe(401);
  });

  it('passes through to the route handler when the token matches', async () => {
    const { POST } = await import('./route');
    const r = await POST(
      makeRequest({ Authorization: `Bearer ${VALID_TOKEN}` }, validBody),
    );
    // 503 because KV is unconfigured, auth passed, body validated.
    expect(r.status).toBe(503);
    const j = await r.json();
    expect(j.error).toBe('storage_not_configured');
  });

  it('returns 400 on invalid JSON body AFTER auth passes', async () => {
    const { POST } = await import('./route');
    const r = await POST(
      new Request('http://localhost/api/settings/notifications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}`, 'content-type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error).toBe('invalid_json');
  });
});
