import type { Alert, ChannelConfig } from '../types.js';
import { assertPublicHttps } from '../lib/ssrf-guard.js';

const MAX_BODY_BYTES = 1024;
const WEBHOOK_TIMEOUT_MS = 8000;

/**
 * Custom-webhook delivery. Users supply any HTTPS URL; the notifier
 * POSTs the alert as JSON with an HMAC signature header so the
 * receiver can verify authenticity.
 *
 * Phase 2c: SSRF guard, 8s timeout, 1KB body cap, audit logging.
 */
export async function deliverWebhook(alert: Alert, config: ChannelConfig & { hmacSecret?: string }): Promise<void> {
  if (!config.customWebhookUrl) throw new Error('customWebhookUrl missing');

  // SSRF guard: validate URL is HTTPS and resolves to public IP
  const validatedUrl = await assertPublicHttps(config.customWebhookUrl);

  let body = JSON.stringify({ schema: 'atrium-alert-v1', alert });

  // Cap body to 1KB
  if (body.length > MAX_BODY_BYTES) {
    console.warn(JSON.stringify({ event: 'webhook_body_truncated', original: body.length, cap: MAX_BODY_BYTES }));
    body = body.slice(0, MAX_BODY_BYTES);
  }

  const signature = config.hmacSecret ? await hmacSha256(config.hmacSecret, body) : '';

  const start = Date.now();
  const r = await fetch(validatedUrl.href, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Atrium-Signature': signature,
      'X-Atrium-Timestamp': String(Math.floor(Date.now() / 1000)),
    },
    body,
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  });
  const latencyMs = Date.now() - start;

  // Audit log every delivery attempt
  console.log(JSON.stringify({
    event: 'webhook_delivery',
    host: validatedUrl.hostname,
    status: r.status,
    latencyMs,
    ok: r.ok,
  }));

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
