import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer();

beforeAll(() => {
  process.env.RESEND_API_KEY = 'test-resend-key';
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Email channel', () => {
  it('sends email via Resend API', async () => {
    let sentPayload: any;
    server.use(
      http.post('https://api.resend.com/emails', async ({ request }) => {
        sentPayload = await request.json();
        return HttpResponse.json({ id: 'email-123' });
      }),
    );

    const { deliverEmail } = await import('./email.js');
    await deliverEmail(
      { id: '0x1-0', kind: 'emergency_pause_invoked', contract: 'PraetorTimelock', blockNumber: 200, timestamp: 1700000000, title: 'Emergency Pause', body: 'Praetor timelock paused', severity: 'critical' } as any,
      { emailAddress: 'ops@useatrium.me' } as any,
    );

    expect(sentPayload).toHaveProperty('to');
    expect(sentPayload.subject).toContain('Emergency Pause');
  });

  it('throws on Resend API failure', async () => {
    server.use(
      http.post('https://api.resend.com/emails', () =>
        HttpResponse.json({ error: 'rate_limited' }, { status: 429 }),
      ),
    );

    const { deliverEmail } = await import('./email.js');
    await expect(
      deliverEmail(
        { id: '0x1-0', kind: 'test', contract: 'Test', blockNumber: 1, timestamp: 1, title: 'Test', body: 'Test', severity: 'info' } as any,
        { emailAddress: 'test@test.com' } as any,
      ),
    ).rejects.toThrow();
  });
});
