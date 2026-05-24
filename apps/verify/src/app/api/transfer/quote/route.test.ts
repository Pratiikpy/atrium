import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/deployments-registry', () => ({
  loadContractAddress: vi.fn(),
}));

import { loadContractAddress } from '@/lib/deployments-registry';

/**
 * Iter 70 audit fix: locks JJ-4 registry-helper migration on
 * /api/transfer/quote. The route's contract: pending when Aqueduct
 * isn't deployed OR when from == to. Quote shape stays deterministic
 * given the same inputs.
 */

function makeRequest(query: string): NextRequest {
  const url = `http://localhost/api/transfer/quote${query ? '?' + query : ''}`;
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/transfer/quote — pending paths', () => {
  it('returns pending when Aqueduct undeployed', async () => {
    (loadContractAddress as any).mockResolvedValue(null);
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest(''))).json();
    expect(json.source).toBe('pending');
    expect(json.detail).toBe('aqueduct not deployed');
    expect(json.estimatedSeconds).toBeNull();
    expect(json.ccipFeeUsd).toBeNull();
    expect(json.gasFeeUsd).toBeNull();
  });

  it('returns pending when from == to', async () => {
    (loadContractAddress as any).mockResolvedValue('0x' + '1'.repeat(40));
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest('from=arb-sepolia&to=arb-sepolia'))).json();
    expect(json.source).toBe('pending');
    expect(json.detail).toBe('from == to');
  });

  it('queries aqueduct address from deployments registry', async () => {
    (loadContractAddress as any).mockResolvedValue(null);
    const { GET } = await import('./route');
    await GET(makeRequest(''));
    expect(loadContractAddress).toHaveBeenCalledWith('aqueduct');
  });
});

describe('GET /api/transfer/quote — happy path quote shape', () => {
  beforeEach(() => {
    (loadContractAddress as any).mockResolvedValue('0x' + '1'.repeat(40));
  });

  it('returns source:aqueduct + fee/gas fields when Aqueduct deployed', async () => {
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest('amount=1000'))).json();
    expect(json.source).toBe('aqueduct');
    expect(json.ccipFeeUsd).toBe('$0.00');
    expect(json.gasFeeUsd).toBe('$0.00 · Postern sponsored');
    expect(json.postedAt).toBe('on arrival');
  });

  it('estimatedSeconds base ~8.4s for small amounts', async () => {
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest('amount=1000'))).json();
    // Formula: 8.4 + min(2, amount/100_000). 1000/100_000 = 0.01.
    expect(json.estimatedSeconds).toBeCloseTo(8.41, 2);
  });

  it('estimatedSeconds caps at +2s for very large amounts', async () => {
    const { GET } = await import('./route');
    // 1M → 1M/100_000 = 10, min(2, 10) = 2. Total 10.4.
    const json = await (await GET(makeRequest('amount=1000000'))).json();
    expect(json.estimatedSeconds).toBe(10.4);
  });

  it('clamps negative amounts to 0 in the size scaling', async () => {
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest('amount=-5000'))).json();
    expect(json.estimatedSeconds).toBe(8.4);
  });

  it('clamps non-numeric amount to 0', async () => {
    const { GET } = await import('./route');
    const json = await (await GET(makeRequest('amount=abc'))).json();
    expect(json.estimatedSeconds).toBe(8.4);
  });
});
