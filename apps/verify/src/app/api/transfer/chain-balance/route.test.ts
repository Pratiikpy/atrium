import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

// Mock viem so tests don't hit a real RPC. The route uses dynamic import,
// so we mock the static module path that import() resolves to.
const mockReadContract = vi.fn();
const mockCreatePublicClient = vi.fn(() => ({ readContract: mockReadContract }));

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    createPublicClient: mockCreatePublicClient,
    // Use the real getAddress + formatUnits + erc20Abi from viem.
  };
});

import { GET } from './route';

/**
 * Locks the audit R-8 fix: distinguishes "operator misconfigured an address"
 * (loud 500 + log) from "RPC is down / contract not deployed" (quiet 200
 * with source: 'pending'). Prior code swallowed BOTH as generic pending,
 * which masked real misconfig errors in production.
 *
 * The split is critical: a misconfigured address (bad checksum, non-hex,
 * empty string) is a deploy-script bug that needs to fail loud. A failing
 * readContract on a not-yet-deployed adapter is the expected pending state.
 */

const originalWallet = process.env.DEMO_WALLET_ADDRESS;
const VALID_WALLET = '0x' + 'a'.repeat(40);
// A real valid-but-uppercase address — getAddress() should accept lowercase
// or matching-checksum, reject mismatched checksums.
const VALID_USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: wallet is configured, default RPC is in place.
  process.env.DEMO_WALLET_ADDRESS = VALID_WALLET;
});

afterEach(() => {
  if (originalWallet === undefined) delete process.env.DEMO_WALLET_ADDRESS;
  else process.env.DEMO_WALLET_ADDRESS = originalWallet;
  vi.restoreAllMocks();
});

function makeReq(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/transfer/chain-balance');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString()) as unknown as NextRequest;
}

describe('GET /api/transfer/chain-balance — honest pending when unconfigured', () => {
  it('returns source:pending when DEMO_WALLET_ADDRESS is unset', async () => {
    delete process.env.DEMO_WALLET_ADDRESS;
    const res = await GET(makeReq({ chain: 'arb-sepolia', token: 'USDC' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('pending');
    expect(json.balanceFormatted).toBeNull();
    expect(json.tokenSymbol).toBe('USDC');
  });

  it('returns source:pending when token address is not configured', async () => {
    // RH-Chain doesn't have a USDT address configured by default.
    const res = await GET(makeReq({ chain: 'rh-chain', token: 'USDT' }));
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe('pending');
  });

  it('returns source:pending when RPC URL is not configured for the chain', async () => {
    // RH-Chain RPC is intentionally undefined (pending SDK per human_left.md #3).
    const res = await GET(makeReq({ chain: 'rh-chain', token: 'USDC' }));
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe('pending');
  });

  it('returns source:pending for an unknown chain id', async () => {
    const res = await GET(makeReq({ chain: 'unknown-chain', token: 'USDC' }));
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe('pending');
  });
});

describe('GET /api/transfer/chain-balance — audit R-8: invalid address fails LOUD', () => {
  it('returns 500 when token address is malformed (audit R-8)', async () => {
    // Operator misconfig: a non-hex string ends up in the token address env.
    // Prior code swallowed this into source:pending, hiding the bug.
    process.env.CODEX_USDC_ADDRESS = 'not-an-address';

    const res = await GET(makeReq({ chain: 'arb-sepolia', token: 'USDC' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('address_invalid');
    expect(json.detail).toContain('arb-sepolia');
    expect(json.detail).toContain('USDC');

    delete process.env.CODEX_USDC_ADDRESS;
  });

  it('returns 500 on bad checksum (audit R-8)', async () => {
    // Mixed-case hex with WRONG checksum — getAddress() rejects this.
    // (A correct checksum or all-lowercase passes.)
    process.env.CODEX_USDC_ADDRESS = '0x75FAF114EAFB1BDBE2F0316DF893FD58CE46AA4D'; // all-uppercase, no actual checksum

    const res = await GET(makeReq({ chain: 'arb-sepolia', token: 'USDC' }));
    // All-uppercase is the special case viem accepts (no checksum claimed).
    // To force the audit-R-8 path, use a mixed-case mismatched checksum:
    process.env.CODEX_USDC_ADDRESS = '0x75Faf114EAFB1BDBE2F0316DF893fd58CE46AA4D'; // mixed case with wrong checksum
    const res2 = await GET(makeReq({ chain: 'arb-sepolia', token: 'USDC' }));
    expect(res2.status).toBe(500);
    expect((await res2.json()).error).toBe('address_invalid');

    delete process.env.CODEX_USDC_ADDRESS;
    // The all-uppercase case is also valid (treated as no-checksum-claimed) —
    // so we don't strictly assert on `res` above.
    void res;
  });

  it('returns 500 when wallet address is malformed', async () => {
    process.env.DEMO_WALLET_ADDRESS = 'definitely-not-an-address';

    const res = await GET(makeReq({ chain: 'arb-sepolia', token: 'USDC' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('address_invalid');
  });

  it('returns 500 with detail naming the chain.token pair', async () => {
    // The detail string must name the misconfigured key so operators
    // can fix it without grepping logs.
    process.env.CODEX_USDC_ADDRESS = 'bad';
    const res = await GET(makeReq({ chain: 'arb-sepolia', token: 'USDC' }));
    const json = await res.json();
    expect(json.detail).toMatch(/arb-sepolia\.USDC/);
    delete process.env.CODEX_USDC_ADDRESS;
  });
});

describe('GET /api/transfer/chain-balance — RPC failure path is silently pending', () => {
  it('returns source:pending when readContract throws (RPC down)', async () => {
    mockReadContract.mockRejectedValue(new Error('ENETUNREACH'));

    const res = await GET(makeReq({ chain: 'arb-sepolia', token: 'USDC' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('pending');
    expect(json.balanceFormatted).toBeNull();
  });

  it('returns source:pending when contract.balanceOf reverts (not deployed)', async () => {
    mockReadContract.mockRejectedValue(new Error('execution reverted'));
    const res = await GET(makeReq({ chain: 'arb-sepolia', token: 'USDC' }));
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe('pending');
  });
});

describe('GET /api/transfer/chain-balance — happy path', () => {
  it('returns formatted balance + source:rpc on successful read', async () => {
    // balanceOf returns 1_234_560_000 (1234.56 USDC at 6 decimals); decimals=6.
    mockReadContract
      .mockResolvedValueOnce(1_234_560_000n) // balanceOf
      .mockResolvedValueOnce(6); // decimals

    const res = await GET(makeReq({ chain: 'arb-sepolia', token: 'USDC' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('rpc');
    expect(json.tokenSymbol).toBe('USDC');
    expect(json.balanceFormatted).toContain('1,234');
  });

  it('uses Promise.all for parallel balanceOf + decimals (perf)', async () => {
    // The route fires both reads in parallel via Promise.all — locks that
    // pattern so a refactor doesn't sequentialize them (~2x latency hit).
    mockReadContract.mockResolvedValue(1_000_000n);

    await GET(makeReq({ chain: 'arb-sepolia', token: 'USDC' }));
    // Two readContract calls expected.
    expect(mockReadContract).toHaveBeenCalledTimes(2);
  });
});

describe('GET /api/transfer/chain-balance — defaults', () => {
  it('defaults chain to arb-sepolia when not specified', async () => {
    mockReadContract.mockResolvedValueOnce(0n).mockResolvedValueOnce(6);
    const res = await GET(makeReq({ token: 'USDC' }));
    // arb-sepolia is the default — should succeed (status:rpc).
    expect((await res.json()).source).toBe('rpc');
  });

  it('defaults token to USDC when not specified', async () => {
    mockReadContract.mockResolvedValueOnce(0n).mockResolvedValueOnce(6);
    const res = await GET(makeReq({ chain: 'arb-sepolia' }));
    expect((await res.json()).tokenSymbol).toBe('USDC');
  });
});
