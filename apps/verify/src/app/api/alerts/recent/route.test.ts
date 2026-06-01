import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Iter 66 audit fix: locks the input-validation contract on
 * /api/alerts/recent.
 *
 * - Limit clamp: parseUintOrNull rejects non-digit strings, then
 *   Math.min caps at MAX_LIMIT=100. Default 25 on missing/invalid.
 * - Closed-enum kind: rejected with 400 + structured error string
 *   if outside the 6 canonical AlertEvent kinds.
 * - 503 on Scribe failure (NOT silent fallback to []), alerts are
 *   the ops timeline; a missing alert during an oracle disagreement
 *   is the load-bearing security signal. Honest "scribe_unavailable"
 *   503 beats silent "all green" 200.
 */

function makeRequest(query: string): NextRequest {
  const url = `http://localhost/api/alerts/recent${query ? '?' + query : ''}`;
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/alerts/recent, input validation', () => {
  it('rejects non-canonical kind with 400 + invalid_kind', async () => {
    const { GET } = await import('./route');
    const res = await GET(makeRequest('kind=invented_alert_kind'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_kind');
    expect(json.detail).toContain('oracle_disagreement');
  });

  it('accepts every canonical kind in the closed enum', async () => {
    (gql as any).mockResolvedValue({ alertEvents: [] });
    const { GET } = await import('./route');
    const canonical = [
      'oracle_disagreement',
      'vigil_queue_failed',
      'link_balance_low',
      'usdc_paused',
      'adapter_emergency_deregistered',
      'emergency_pause_invoked',
    ];
    for (const kind of canonical) {
      const res = await GET(makeRequest(`kind=${kind}`));
      expect(res.status).toBe(200);
    }
  });

  it('accepts missing kind (no filter)', async () => {
    (gql as any).mockResolvedValue({ alertEvents: [] });
    const { GET } = await import('./route');
    const res = await GET(makeRequest(''));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/alerts/recent, limit clamp', () => {
  it('uses default 25 on missing limit', async () => {
    let captured: any;
    (gql as any).mockImplementation(async (_q: string, vars: any) => {
      captured = vars;
      return { alertEvents: [] };
    });
    const { GET } = await import('./route');
    await GET(makeRequest(''));
    expect(captured.limit).toBe(25);
  });

  it('uses default 25 on non-numeric limit', async () => {
    let captured: any;
    (gql as any).mockImplementation(async (_q: string, vars: any) => {
      captured = vars;
      return { alertEvents: [] };
    });
    const { GET } = await import('./route');
    await GET(makeRequest('limit=abc'));
    expect(captured.limit).toBe(25);
  });

  it('clamps limit to MAX_LIMIT=100 on huge input', async () => {
    let captured: any;
    (gql as any).mockImplementation(async (_q: string, vars: any) => {
      captured = vars;
      return { alertEvents: [] };
    });
    const { GET } = await import('./route');
    await GET(makeRequest('limit=99999'));
    expect(captured.limit).toBe(100);
  });

  it('respects valid in-range limit', async () => {
    let captured: any;
    (gql as any).mockImplementation(async (_q: string, vars: any) => {
      captured = vars;
      return { alertEvents: [] };
    });
    const { GET } = await import('./route');
    await GET(makeRequest('limit=42'));
    expect(captured.limit).toBe(42);
  });
});

describe('GET /api/alerts/recent, since parameter', () => {
  it('defaults to since=0 when missing', async () => {
    let captured: any;
    (gql as any).mockImplementation(async (_q: string, vars: any) => {
      captured = vars;
      return { alertEvents: [] };
    });
    const { GET } = await import('./route');
    await GET(makeRequest(''));
    expect(captured.where.timestamp_gt).toBe('0');
  });

  it('passes valid unix-seconds since through to gql', async () => {
    let captured: any;
    (gql as any).mockImplementation(async (_q: string, vars: any) => {
      captured = vars;
      return { alertEvents: [] };
    });
    const { GET } = await import('./route');
    await GET(makeRequest('since=1700000000'));
    expect(captured.where.timestamp_gt).toBe('1700000000');
  });

  it('falls back to since=0 on malformed input', async () => {
    let captured: any;
    (gql as any).mockImplementation(async (_q: string, vars: any) => {
      captured = vars;
      return { alertEvents: [] };
    });
    const { GET } = await import('./route');
    await GET(makeRequest('since=NaN'));
    expect(captured.where.timestamp_gt).toBe('0');
  });
});

describe('GET /api/alerts/recent, success path', () => {
  it('passes through alertEvents under {alerts, count, source}', async () => {
    const events = [
      { id: '0xa', kind: 'oracle_disagreement', contract: 'plinth', blockNumber: '100', timestamp: '1700000000' },
      { id: '0xb', kind: 'link_balance_low', contract: 'aqueduct', blockNumber: '101', timestamp: '1700000100' },
    ];
    (gql as any).mockResolvedValue({ alertEvents: events });
    const { GET } = await import('./route');
    const res = await GET(makeRequest(''));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.alerts).toEqual(events);
    expect(json.count).toBe(2);
    expect(json.source).toBe('scribe');
  });
});

describe('GET /api/alerts/recent, Scribe outage returns 503 (not silent fallback)', () => {
  it('returns 503 + scribe_unavailable on gql failure (NOT empty 200)', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe timeout'));
    const { GET } = await import('./route');
    const res = await GET(makeRequest(''));
    // Load-bearing: the ops timeline is the canary for the entire
    // protocol. A 200 with empty alerts during a Scribe outage would
    // tell operators "all clear" when reality is "we don't know."
    // 503 + scribe_unavailable forces the consumer to surface the
    // outage explicitly.
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('scribe_unavailable');
    expect(json.detail).toBeDefined();
  });
});
