import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST } from './route';

/**
 * The /api/chaos/inject route powers PRD §22.5 Chaos Mode — the judge-facing
 * fault-injection button in Verifier step 4. The route MUST refuse anything
 * outside the whitelisted fault enum so a hostile caller can't pivot the
 * agent into running arbitrary scripts.
 *
 * Validation rules locked here:
 *   1. Body must be valid JSON
 *   2. fault must be one of the 5 enum values
 *   3. When PRAETOR_CHAOS_URL is unset, 503 with a clear "not deployed" message
 *      (NOT a fake success — audit J-H3 discipline)
 *   4. When the agent is reachable, the route forwards and surfaces the
 *      agent's response. Upstream errors → 502, network errors → 503.
 *
 * Mocks `fetch` so tests don't depend on a real chaos agent.
 */

const originalFetch = global.fetch;
const originalChaosUrl = process.env.PRAETOR_CHAOS_URL;

beforeEach(() => {
  global.fetch = vi.fn();
  delete process.env.PRAETOR_CHAOS_URL;
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalChaosUrl === undefined) delete process.env.PRAETOR_CHAOS_URL;
  else process.env.PRAETOR_CHAOS_URL = originalChaosUrl;
  vi.restoreAllMocks();
});

function makeReq(body: unknown): NextRequest {
  return new Request('http://localhost/api/chaos/inject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('POST /api/chaos/inject — validation', () => {
  it('rejects non-JSON body with 400 invalid_json', async () => {
    const req = new Request('http://localhost/api/chaos/inject', {
      method: 'POST',
      body: 'not-json',
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_json');
  });

  it('rejects missing fault field', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_fault');
  });

  it('rejects unknown fault enum value', async () => {
    // The closed enum is the security gate — a fault like "rm_rf_tmp" must
    // never make it to the agent.
    const res = await POST(makeReq({ fault: 'rm_rf_tmp' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_fault');
    // Detail must name the allowed enum so callers see the contract.
    expect(json.detail).toMatch(/oracle_drift/);
    expect(json.detail).toMatch(/keeper_offline/);
  });

  it('rejects SQL-injection-style fault payload', async () => {
    const res = await POST(makeReq({ fault: "oracle_drift; DROP TABLE positions;" }));
    expect(res.status).toBe(400);
  });

  it('accepts all 5 canonical fault values when agent URL is set', async () => {
    process.env.PRAETOR_CHAOS_URL = 'https://chaos.atrium.fi';
    // Response bodies are one-shot streams — the second `await r.json()` on
    // the same Response throws "body used already." `mockImplementation`
    // returns a fresh Response per call so all 5 iterations succeed.
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, recoveredIn: 800 }), { status: 200 }),
      ),
    );
    const allFaults = ['oracle_drift', 'keeper_offline', 'partial_fill', 'gas_spike', 'indexer_stall'];
    for (const f of allFaults) {
      const res = await POST(makeReq({ fault: f }));
      expect(res.status).toBe(200);
    }
  });
});

describe('POST /api/chaos/inject — honest 503 when undeployed', () => {
  it('returns 503 chaos_agent_not_deployed when PRAETOR_CHAOS_URL is unset', async () => {
    // Audit J-H3 discipline: prior code returned a fake `{ ok: true }`.
    // Now the route must surface the honest "not deployed" state with the
    // ROADMAP reference.
    const res = await POST(makeReq({ fault: 'oracle_drift' }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('chaos_agent_not_deployed');
    expect(json.detail).toMatch(/Month 9/);
    expect(json.detail).toMatch(/PRAETOR_CHAOS_URL/);
  });

  it('honest-503 fires BEFORE any network call', async () => {
    // Make fetch throw — if the route were calling it, we'd see the error.
    // Confirms the env-var check short-circuits.
    (global.fetch as any).mockRejectedValue(new Error('fetch should not be called'));
    const res = await POST(makeReq({ fault: 'gas_spike' }));
    expect(res.status).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('POST /api/chaos/inject — agent proxy', () => {
  beforeEach(() => {
    process.env.PRAETOR_CHAOS_URL = 'https://chaos.atrium.fi';
  });

  it('forwards the fault to the agent and returns its response', async () => {
    const agentResponse = { ok: true, fault: 'oracle_drift', recoveredIn: 1240, paused: true };
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(agentResponse), { status: 200 }),
    );

    const res = await POST(makeReq({ fault: 'oracle_drift' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(agentResponse);

    // Verify the proxy call shape.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('https://chaos.atrium.fi/inject');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ fault: 'oracle_drift' });
  });

  it('returns 502 agent_error when the agent responds non-2xx', async () => {
    (global.fetch as any).mockResolvedValue(new Response('', { status: 500 }));
    const res = await POST(makeReq({ fault: 'gas_spike' }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe('agent_error');
    expect(json.status).toBe(500);
  });

  it('returns 503 agent_unreachable on network error', async () => {
    (global.fetch as any).mockRejectedValue(new Error('ENOTFOUND chaos.atrium.fi'));
    const res = await POST(makeReq({ fault: 'indexer_stall' }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('agent_unreachable');
    expect(json.detail).toMatch(/ENOTFOUND/);
  });

  it('returns 503 on timeout (10s AbortSignal)', async () => {
    // Simulate a timeout by rejecting with an AbortError.
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    (global.fetch as any).mockRejectedValue(abortErr);
    const res = await POST(makeReq({ fault: 'partial_fill' }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('agent_unreachable');
  });
});
