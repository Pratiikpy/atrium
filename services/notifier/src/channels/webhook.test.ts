import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { deliverWebhook } from './webhook.js';
import type { Alert, ChannelConfig } from '../types.js';

const mockAlert: Alert = {
  kind: 'link_balance_low',
  severity: 'warning',
  title: 'Aqueduct LINK balance low',
  body: 'LINK balance below the CCIP fee threshold.',
  blockNumber: 100,
  timestamp: 1700000000,
};

// A minimal-but-valid webhook ChannelConfig. deliverWebhook reads
// customWebhookUrl (+ optional hmacSecret); the other ChannelConfig fields
// are required by the type but unused on this delivery path.
const webhookConfig: ChannelConfig = {
  kind: 'webhook',
  enabled: true,
  minSeverity: 'info',
  customWebhookUrl: 'https://example.com/hook',
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Webhook channel', () => {
  it('sends correct payload format', async () => {
    let receivedBody: any;
    server.use(
      http.post('https://example.com/hook', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );

    await deliverWebhook(mockAlert, webhookConfig);
    expect(receivedBody).toHaveProperty('schema', 'atrium-alert-v1');
    expect(receivedBody).toHaveProperty('alert');
    expect(receivedBody.alert.kind).toBe('link_balance_low');
  });

  it('throws on 5xx (retriable)', async () => {
    server.use(
      http.post('https://example.com/hook', () => HttpResponse.text('Internal Error', { status: 500 })),
    );

    await expect(
      deliverWebhook(mockAlert, webhookConfig)
    ).rejects.toThrow(/webhook_500/);
  });

  it('throws on 4xx (no retry)', async () => {
    server.use(
      http.post('https://example.com/hook', () => HttpResponse.text('Bad Request', { status: 400 })),
    );

    await expect(
      deliverWebhook(mockAlert, webhookConfig)
    ).rejects.toThrow(/webhook_400/);
  });

  it('truncates body exceeding 1KB cap', async () => {
    let receivedLength = 0;
    server.use(
      http.post('https://example.com/hook', async ({ request }) => {
        const text = await request.text();
        receivedLength = text.length;
        return HttpResponse.json({ ok: true });
      }),
    );

    const bigAlert = { ...mockAlert, detail: 'x'.repeat(2000) } as any;
    await deliverWebhook(bigAlert, webhookConfig);
    expect(receivedLength).toBeLessThanOrEqual(1024);
  });

  it('emits audit log on delivery', async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => { logs.push(msg); };

    server.use(
      http.post('https://example.com/hook', () => HttpResponse.json({ ok: true })),
    );

    await deliverWebhook(mockAlert, webhookConfig);
    console.log = origLog;

    const auditLog = logs.find(l => l.includes('webhook_delivery'));
    expect(auditLog).toBeDefined();
    expect(JSON.parse(auditLog!)).toHaveProperty('event', 'webhook_delivery');
  });
});
