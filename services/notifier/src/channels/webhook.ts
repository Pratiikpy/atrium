import type { Alert, ChannelConfig } from '../types.js';

/**
 * Custom-webhook delivery. Users supply any HTTPS URL; the notifier
 * POSTs the alert as JSON with an HMAC signature header so the
 * receiver can verify authenticity.
 *
 * Per-user HMAC secret is derived from a session-bound key the user
 * sets when configuring the webhook in /app/settings/notifications.
 * Stored encrypted in Vercel KV.
 */
export async function deliverWebhook(alert: Alert, config: ChannelConfig & { hmacSecret?: string }): Promise<void> {
  if (!config.customWebhookUrl) throw new Error('customWebhookUrl missing');

  const body = JSON.stringify({
    schema: 'atrium-alert-v1',
    alert,
  });
  const signature = config.hmacSecret ? await hmacSha256(config.hmacSecret, body) : '';

  const r = await fetch(config.customWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Atrium-Signature': signature,
      'X-Atrium-Timestamp': String(Math.floor(Date.now() / 1000)),
    },
    body,
  });
  if (!r.ok) {
    throw new Error(`webhook_${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}

async function hmacSha256(key: string, body: string): Promise<string> {
  // Node 20+ + browser-compatible Web Crypto.
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
