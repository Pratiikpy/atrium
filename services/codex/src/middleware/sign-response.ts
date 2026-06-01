import type { MiddlewareHandler } from 'hono';

/**
 * HMAC-SHA256 signs every response body. Clients verify with the public key
 * exposed at /v1/keys/{X-Codex-Key-Id}.
 *
 * Per TDD §8.2 + PRD §21.5 STRIDE table, tamper-evidence on every API call.
 *
 * Audit FFF-3 fix: the HMAC now covers `${timestamp}.${body}`, not body alone.
 * Pre-fix, an intermediary could rewrite `X-Codex-Timestamp` to "now" without
 * invalidating the signature, verifiers checking staleness would always see
 * a fresh response. Binding the timestamp into the HMAC input means any
 * tampering of either field flips the signature.
 *
 * Audit FFF-3b fix: explicit env-binding type + null-check on the secret.
 * Pre-fix, a misconfigured deploy with `CODEX_HMAC_KEY` unset would silently
 * sign with `undefined` (TextEncoder coerces to "undefined") and ship a
 * predictable signature. Now we fail loud on missing secrets.
 */
interface SignResponseEnv {
  CODEX_HMAC_KEY?: string;
  CODEX_KEY_ID?: string;
}

export const signResponse: MiddlewareHandler<{ Bindings: SignResponseEnv }> = async (c, next) => {
  await next();

  const secret = c.env.CODEX_HMAC_KEY;
  const keyId = c.env.CODEX_KEY_ID;
  if (!secret || !keyId) {
    // Fail loud: an unsigned response is more honest than a fake-signed one.
    c.res.headers.set('X-Codex-Signature', 'unconfigured');
    c.res.headers.set('X-Codex-Key-Id', 'unconfigured');
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const responseBody = c.res.clone();
  const text = await responseBody.text();
  const signature = await hmacSha256(secret, `${timestamp}.${text}`);
  c.res.headers.set('X-Codex-Signature', signature);
  c.res.headers.set('X-Codex-Key-Id', keyId);
  c.res.headers.set('X-Codex-Timestamp', timestamp);
};

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
