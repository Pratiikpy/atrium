import type { Alert, ChannelConfig } from '../types.js';
import { assertPublicHttps } from '../lib/ssrf-guard.js';

const MAX_BODY_BYTES = 1024;
const WEBHOOK_TIMEOUT_MS = 8000;

/**
 * Custom-webhook delivery. Users supply any HTTPS URL; the notifier
 * POSTs the alert as JSON with an HMAC signature header so the
 * receiver can verify authenticity.
 *
 * SSRF posture (audit CRT-02 + 2026-05-29 review):
 *  - assertPublicHttps requires HTTPS and rejects any URL that resolves to a
 *    private / link-local / loopback / CGNAT address, including IPv4-mapped
 *    IPv6 forms (::ffff:127.0.0.1) that the URL parser canonicalises to hex.
 *  - `redirect: 'manual'` means fetch does NOT follow 3xx, so a receiver
 *    cannot bounce us to a private IP after passing the guard. A 3xx is
 *    treated as an error.
 *  - Residual: fetch re-resolves the hostname at connect time, so a DNS rebind
 *    in the (sub-second) window after the guard's lookup is not fully closed
 *    here. Pinning the connection to assertPublicHttps's returned IP needs a
 *    node:https / undici dispatcher (msw does not intercept those in this test
 *    setup); tracked as a follow-up. The public-IP gate + no-redirect rule
 *    already block the practical exploit paths.
 *  - 8s timeout, 1KB body cap, audit logging.
 */
export async function deliverWebhook(alert: Alert, config: ChannelConfig & { hmacSecret?: string }): Promise<void> {
  if (!config.customWebhookUrl) throw new Error('customWebhookUrl missing');

  // SSRF guard: validate URL is HTTPS and resolves to public IP
  const target = await assertPublicHttps(config.customWebhookUrl);

  let body = JSON.stringify({ schema: 'atrium-alert-v1', alert });

  // Cap body to 1KB
  if (body.length > MAX_BODY_BYTES) {
    console.warn(JSON.stringify({ event: 'webhook_body_truncated', original: body.length, cap: MAX_BODY_BYTES }));
    body = body.slice(0, MAX_BODY_BYTES);
  }

  const signature = config.hmacSecret ? await hmacSha256(config.hmacSecret, body) : '';

  const start = Date.now();
  const r = await fetch(target.url.href, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Atrium-Signature': signature,
      'X-Atrium-Timestamp': String(Math.floor(Date.now() / 1000)),
    },
    body,
    // Never chase a redirect: a 3xx Location could point at a private IP that
    // the SSRF guard never validated.
    redirect: 'manual',
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  });
  const latencyMs = Date.now() - start;

  // Audit log every delivery attempt
  console.log(JSON.stringify({
    event: 'webhook_delivery',
    host: target.url.hostname,
    status: r.status,
    latencyMs,
    ok: r.ok,
  }));

  // With redirect:'manual', a cross-origin 3xx surfaces as an opaqueredirect
  // (status 0, type 'opaqueredirect'); a same-context 3xx surfaces as 3xx.
  // Either way, refuse to follow.
  if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) {
    throw new Error(`webhook_redirect: refused to follow redirect (SSRF guard; webhooks must not redirect)`);
  }

  if (!r.ok) {
    throw new Error(`webhook_${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}

async function hmacSha256(key: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
