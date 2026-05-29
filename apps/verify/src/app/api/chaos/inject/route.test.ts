import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

/**
 * The /api/chaos/inject route powers PRD section 22.5 Chaos Mode  the
 * judge-facing fault-injection button in Verifier step 4. Phase zeta.5
 * (2026-05-25) refactored this route from the agent-proxy shape to direct
 * Praetor-signed on-chain action. The current contract:
 *
 *   1. Body must be valid JSON.
 *   2. fault must be one of the 5 canonical enum values.
 *   3. CHAOS_PRIVATE_KEY env (hex 0x + 64) gates signing. Without it the
 *      route returns 503 chaos_key_not_configured.
 *   4. The deployments registry must be loadable; otherwise 503
 *      registry_unreachable.
 *   5. gas_spike and indexer_stall always return 200 with simulated:true
 *      because gas price and Scribe ingestion are not on-chain levers.
 *   6. oracle_drift, keeper_offline, partial_fill send real viem
 *      writeContract calls (mocked here) and return tx + arbiscan URL.
 *
 * viem is dynamically imported in route.ts. We mock the same module path
 * so the route reads the mocked exports.
 */

const originalChaosKey = process.env.CHAOS_PRIVATE_KEY;
const TEST_KEY = '0x' + '11'.repeat(32);
const TEST_TX = '0xabc' + '0'.repeat(61);

// viem mock state. Reset per test.
let writeContractMock: ReturnType<typeof vi.fn>;
let mockRegistry: { contracts: Record<string, { address: string }> } | null;

vi.mock('viem', () => ({
  createWalletClient: vi.fn(() => ({
    writeContract: (...args: unknown[]) => writeContractMock(...args),
  })),
  http: vi.fn(() => ({})),
  keccak256: vi.fn((x: unknown) => `0xkeccak_${String(x)}`),
  toHex: vi.fn((s: unknown) => `0xhex_${String(s)}`),
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
  mockRegistry = {
    contracts: {
      'praetor-timelock': { address: '0x1111111111111111111111111111111111111111' },
      plinth: { address: '0x2222222222222222222222222222222222222222' },
      vigil: { address: '0x3333333333333333333333333333333333333333' },
      coffer: { address: '0x4444444444444444444444444444444444444444' },
    },
  };
  process.env.CHAOS_PRIVATE_KEY = TEST_KEY;
  vi.resetModules();
  ({ POST } = await import('./route'));
});

afterEach(() => {
  if (originalChaosKey === undefined) delete process.env.CHAOS_PRIVATE_KEY;
  else process.env.CHAOS_PRIVATE_KEY = originalChaosKey;
  vi.restoreAllMocks();
});

// Audit fix (#77): the chaos write routes now reject a MISSING Origin (a
// no-Origin curl/server-to-server POST must not auto-pass the allowlist on a
// route that signs on-chain pauses). The browser Chaos UI always sends an
// Origin, so the default here mirrors that. Pass `null` to exercise the
// no-Origin rejection path.
function makeReq(body: unknown, origin: string | null = 'http://localhost:3000'): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) headers['origin'] = origin;
  return new Request('http://localhost/api/chaos/inject', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

/* ============ Origin gate ============ */

describe('POST /api/chaos/inject - origin gate (#77)', () => {
  it('rejects a request with no Origin header (403, no auto-pass)', async () => {
    const res = await POST(makeReq({ fault: 'oracle_drift' }, null));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('origin_not_allowed');
  });

  it('rejects a disallowed Origin (403)', async () => {
    const res = await POST(makeReq({ fault: 'oracle_drift' }, 'https://evil.example.com'));
    expect(res.status).toBe(403);
  });
});

/* ============ Auth gate ============ */

describe('POST /api/chaos/inject - auth gate', () => {
  it('returns 503 chaos_key_not_configured when CHAOS_PRIVATE_KEY is missing', async () => {
    delete process.env.CHAOS_PRIVATE_KEY;
    vi.resetModules();
    ({ POST } = await import('./route'));
    const res = await POST(makeReq({ fault: 'oracle_drift' }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('chaos_key_not_configured');
    expect(json.detail).toMatch(/CHAOS_PRIVATE_KEY/);
  });

  it('returns 503 chaos_key_not_configured when CHAOS_PRIVATE_KEY is malformed', async () => {
    process.env.CHAOS_PRIVATE_KEY = 'not-a-real-key';
    vi.resetModules();
    ({ POST } = await import('./route'));
    const res = await POST(makeReq({ fault: 'gas_spike' }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('chaos_key_not_configured');
  });
});

/* ============ Validation ============ */

describe('POST /api/chaos/inject - validation', () => {
  it('rejects non-JSON body with 400 invalid_json', async () => {
    const res = await POST(makeReq('not-json'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_json');
  });

  it('rejects missing fault field', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_fault');
  });

  it('rejects unknown fault enum value', async () => {
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
});

/* ============ Registry guard ============ */

describe('POST /api/chaos/inject - registry guard', () => {
  it('returns 503 registry_unreachable when registry load fails', async () => {
    mockRegistry = null;
    const res = await POST(makeReq({ fault: 'oracle_drift' }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('registry_unreachable');
  });
});

/* ============ On-chain faults (real writeContract) ============ */

describe('POST /api/chaos/inject - oracle_drift', () => {
  it('calls PraetorTimelock.emergencyPause(Plinth) and returns tx + arbiscan URL', async () => {
    const res = await POST(makeReq({ fault: 'oracle_drift' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fault).toBe('oracle_drift');
    expect(json.action).toContain('emergencyPause');
    expect(json.tx).toBe(TEST_TX);
    expect(json.arbiscan).toBe(`https://sepolia.arbiscan.io/tx/${TEST_TX}`);
    expect(writeContractMock).toHaveBeenCalledTimes(1);
    const call = writeContractMock.mock.calls[0][0];
    expect(call.address).toBe('0x1111111111111111111111111111111111111111');
    expect(call.functionName).toBe('emergencyPause');
    expect(call.args[0]).toBe('0x2222222222222222222222222222222222222222');
  });

  it('returns 503 missing_contract if Plinth address is absent', async () => {
    mockRegistry!.contracts = {
      'praetor-timelock': { address: '0x1111111111111111111111111111111111111111' },
    };
    const res = await POST(makeReq({ fault: 'oracle_drift' }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('missing_contract');
  });
});

describe('POST /api/chaos/inject - keeper_offline', () => {
  it('calls Vigil.markKeeperMissedWindow', async () => {
    const res = await POST(makeReq({ fault: 'keeper_offline' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fault).toBe('keeper_offline');
    expect(json.tx).toBe(TEST_TX);
    expect(writeContractMock).toHaveBeenCalledTimes(1);
    expect(writeContractMock.mock.calls[0][0].functionName).toBe('markKeeperMissedWindow');
  });
});

describe('POST /api/chaos/inject - partial_fill', () => {
  it('calls Coffer.pauseDeposits with keccak256(reason)', async () => {
    const res = await POST(makeReq({ fault: 'partial_fill' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fault).toBe('partial_fill');
    expect(json.tx).toBe(TEST_TX);
    expect(writeContractMock).toHaveBeenCalledTimes(1);
    const call = writeContractMock.mock.calls[0][0];
    expect(call.address).toBe('0x4444444444444444444444444444444444444444');
    expect(call.functionName).toBe('pauseDeposits');
  });
});

/* ============ Simulated faults (no on-chain action) ============ */

describe('POST /api/chaos/inject - simulated faults', () => {
  it('returns 200 simulated:true for gas_spike without calling writeContract', async () => {
    const res = await POST(makeReq({ fault: 'gas_spike' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fault).toBe('gas_spike');
    expect(json.simulated).toBe(true);
    expect(json.tx).toBeNull();
    expect(writeContractMock).not.toHaveBeenCalled();
  });

  it('returns 200 for indexer_stall without calling writeContract', async () => {
    const res = await POST(makeReq({ fault: 'indexer_stall' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fault).toBe('indexer_stall');
    expect(json.tx).toBeNull();
    expect(writeContractMock).not.toHaveBeenCalled();
  });
});

/* ============ Failure surface ============ */

describe('POST /api/chaos/inject - failure surface', () => {
  it('returns 503 inject_failed with safe detail when writeContract throws', async () => {
    writeContractMock.mockRejectedValueOnce(new Error('rpc rejected: insufficient funds'));
    const res = await POST(makeReq({ fault: 'oracle_drift' }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('inject_failed');
    expect(json.detail).toBeTruthy();
  });
});
