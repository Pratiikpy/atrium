import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

/**
 * /api/chaos/restore is the symmetric counterpart to /inject and signs real
 * on-chain un-pause writes. Same gates: strict Origin allowlist, optional
 * Bearer lockdown, per-IP rate limit, CHAOS_PRIVATE_KEY, fault enum. viem is
 * dynamically imported in the route, so we mock the same module paths.
 */

const originalChaosKey = process.env.CHAOS_PRIVATE_KEY;
const TEST_KEY = '0x' + '11'.repeat(32);
const TEST_TX = '0xabc' + '0'.repeat(61);

let writeContractMock: ReturnType<typeof vi.fn>;
let mockRegistry: { contracts: Record<string, { address: string }> } | null;

vi.mock('viem', () => ({
  createWalletClient: vi.fn(() => ({
    writeContract: (...args: unknown[]) => writeContractMock(...args),
  })),
  http: vi.fn(() => ({})),
}));
vi.mock('viem/chains', () => ({ arbitrumSepolia: { id: 421614 } }));
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({ address: '0xdead' + 'beef'.repeat(9) })),
}));
vi.mock('@/lib/deployments-registry', () => ({
  loadDeploymentRegistry: () => Promise.resolve(mockRegistry),
}));

let POST: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  writeContractMock = vi.fn().mockResolvedValue(TEST_TX);
  mockRegistry = { contracts: { coffer: { address: '0x4444444444444444444444444444444444444444' } } };
  process.env.CHAOS_PRIVATE_KEY = TEST_KEY;
  delete process.env.CHAOS_DRILL_KEY;
  vi.resetModules(); // fresh per-IP rate-limit Map each test
  ({ POST } = await import('./route'));
});

afterEach(() => {
  if (originalChaosKey === undefined) delete process.env.CHAOS_PRIVATE_KEY;
  else process.env.CHAOS_PRIVATE_KEY = originalChaosKey;
  delete process.env.CHAOS_DRILL_KEY;
  vi.restoreAllMocks();
});

function makeReq(body: unknown, origin: string | null = 'http://localhost:3000', bearer?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) headers['origin'] = origin;
  if (bearer) headers['authorization'] = `Bearer ${bearer}`;
  return new Request('http://localhost/api/chaos/restore', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('POST /api/chaos/restore, origin gate', () => {
  it('403 when no Origin header (no auto-pass on an on-chain write)', async () => {
    const r = await POST(makeReq({ fault: 'partial_fill' }, null));
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('origin_not_allowed');
  });
  it('403 on a disallowed Origin', async () => {
    const r = await POST(makeReq({ fault: 'partial_fill' }, 'https://evil.example.com'));
    expect(r.status).toBe(403);
  });
});

describe('POST /api/chaos/restore, bearer lockdown', () => {
  it('401 when CHAOS_DRILL_KEY is set but no Bearer is presented', async () => {
    process.env.CHAOS_DRILL_KEY = 'drill-secret';
    vi.resetModules();
    ({ POST } = await import('./route'));
    const r = await POST(makeReq({ fault: 'partial_fill' }));
    expect(r.status).toBe(401);
  });
  it('passes the bearer gate with the correct token', async () => {
    process.env.CHAOS_DRILL_KEY = 'drill-secret';
    vi.resetModules();
    ({ POST } = await import('./route'));
    const r = await POST(makeReq({ fault: 'partial_fill' }, 'http://localhost:3000', 'drill-secret'));
    expect(r.status).not.toBe(401);
    expect(r.status).not.toBe(403);
  });
});

describe('POST /api/chaos/restore, key + validation', () => {
  it('503 chaos_key_not_configured when CHAOS_PRIVATE_KEY is unset', async () => {
    delete process.env.CHAOS_PRIVATE_KEY;
    vi.resetModules();
    ({ POST } = await import('./route'));
    const r = await POST(makeReq({ fault: 'partial_fill' }));
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('chaos_key_not_configured');
  });
  it('400 invalid_json on a non-JSON body', async () => {
    const r = await POST(makeReq('not-json'));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('invalid_json');
  });
  it('400 invalid_fault on an unknown fault', async () => {
    const r = await POST(makeReq({ fault: 'rm_rf' }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('invalid_fault');
  });
  it('503 registry_unreachable when the registry will not load', async () => {
    mockRegistry = null;
    const r = await POST(makeReq({ fault: 'partial_fill' }));
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('registry_unreachable');
  });
});

describe('POST /api/chaos/restore, fault behavior', () => {
  it('partial_fill calls Coffer.resumeDeposits and returns tx + arbiscan', async () => {
    const r = await POST(makeReq({ fault: 'partial_fill' }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.action).toContain('resumeDeposits');
    expect(j.tx).toBe(TEST_TX);
    expect(j.arbiscan).toBe(`https://sepolia.arbiscan.io/tx/${TEST_TX}`);
    expect(writeContractMock).toHaveBeenCalledTimes(1);
    const call = writeContractMock.mock.calls[0][0];
    expect(call.address).toBe('0x4444444444444444444444444444444444444444');
    expect(call.functionName).toBe('resumeDeposits');
  });

  it('oracle_drift is an honest noop (timelock-gated restore), no writeContract', async () => {
    const r = await POST(makeReq({ fault: 'oracle_drift' }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.action).toBe('noop');
    expect(j.detail).toMatch(/timelock/i);
    expect(writeContractMock).not.toHaveBeenCalled();
  });

  it('rate-limits a rapid second call from the same IP (429)', async () => {
    const first = await POST(makeReq({ fault: 'oracle_drift' }));
    expect(first.status).toBe(200);
    const second = await POST(makeReq({ fault: 'oracle_drift' }));
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBeTruthy();
  });
});
