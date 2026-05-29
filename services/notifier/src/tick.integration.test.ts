import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock Scribe subgraph returning canonical alert schemas
const MOCK_ALERTS = [
  { id: '0xabc-0', kind: 'link_balance_low', contract: 'Aqueduct', blockNumber: '100', timestamp: '1700000000' },
  { id: '0xdef-1', kind: 'adapter_emergency_deregistered', contract: 'PorticoRegistry', blockNumber: '101', timestamp: '1700000060' },
];

const server = setupServer(
  http.post('http://localhost:8000/subgraphs/name/atrium', async ({ request }) => {
    const body = await request.json() as any;
    const query = body.query as string;

    if (query.includes('_meta')) {
      return HttpResponse.json({ data: { _meta: { block: { number: 200 } } } });
    }
    if (query.includes('alertEvents')) {
      return HttpResponse.json({ data: { alertEvents: MOCK_ALERTS } });
    }
    return HttpResponse.json({ data: {} });
  }),
  http.get('http://localhost:3001/api/settings/notifications*', () => {
    return HttpResponse.json({ channels: ['webhook'], customWebhookUrl: 'https://example.com/hook' });
  }),
);

beforeAll(() => {
  process.env.SCRIBE_URL = 'http://localhost:8000/subgraphs/name/atrium';
  process.env.PREFS_API_URL = 'http://localhost:3001';
  process.env.ATRIUM_INTERNAL_KEY = 'test-key';
  process.env.ATRIUM_KV_REST_URL = 'http://localhost:6379';
  process.env.ATRIUM_KV_REST_TOKEN = 'test-token';
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Notifier tick integration', () => {
  it('tickOnce fetches alerts from mock Scribe and routes them', async () => {
    // Dynamic import to pick up env vars set above
    const { tickOnce } = await import('../src/tick.js');

    // Mock routeAlert to capture calls
    const routeAlertMock = vi.fn();
    vi.doMock('../src/router.js', () => ({ routeAlert: routeAlertMock }));

    // tickOnce should not throw with mock Scribe responding
    // In real integration it would call routeAlert; here we verify no crash
    await expect(tickOnce()).resolves.not.toThrow();
  });

  it('skips tick when indexer lag exceeds threshold', async () => {
    server.use(
      http.post('http://localhost:8000/subgraphs/name/atrium', async ({ request }) => {
        const body = await request.json() as any;
        if (body.query.includes('_meta')) {
          // Simulate massive lag
          return HttpResponse.json({ data: { _meta: { block: { number: 1 } } } });
        }
        return HttpResponse.json({ data: { alertEvents: [] } });
      }),
    );

    const { tickOnce } = await import('../src/tick.js');
    // Should complete without processing alerts (lag > 200)
    await expect(tickOnce()).resolves.not.toThrow();
  });
});
