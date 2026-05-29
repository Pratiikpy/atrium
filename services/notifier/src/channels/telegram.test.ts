import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer();

beforeAll(() => {
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Telegram channel', () => {
  it('sends formatted message to Telegram API', async () => {
    let sentPayload: any;
    server.use(
      http.post('https://api.telegram.org/bottest-bot-token/sendMessage', async ({ request }) => {
        sentPayload = await request.json();
        return HttpResponse.json({ ok: true, result: { message_id: 1 } });
      }),
    );

    const { deliverTelegram } = await import('./telegram.js');
    await deliverTelegram(
      { id: '0x1-0', kind: 'link_balance_low', contract: 'Aqueduct', blockNumber: 100, timestamp: 1700000000, title: 'LINK Balance Low', body: 'Aqueduct LINK below threshold', severity: 'warning' } as any,
      { telegramChatId: '12345' } as any,
    );

    expect(sentPayload).toHaveProperty('chat_id', '12345');
    expect(sentPayload.text).toContain('LINK Balance Low');
  });

  it('throws on Telegram API error', async () => {
    server.use(
      http.post('https://api.telegram.org/bottest-bot-token/sendMessage', () =>
        HttpResponse.json({ ok: false, description: 'chat not found' }, { status: 400 }),
      ),
    );

    const { deliverTelegram } = await import('./telegram.js');
    await expect(
      deliverTelegram(
        { id: '0x1-0', kind: 'test', contract: 'Test', blockNumber: 1, timestamp: 1, title: 'Test', body: 'Test body', severity: 'info' } as any,
        { telegramChatId: 'invalid' } as any,
      ),
    ).rejects.toThrow();
  });
});
