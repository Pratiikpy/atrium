import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the deployments registry so the test controls the faucetAddress branch.
const mockLoadContractAddress = vi.fn();
vi.mock('@/lib/deployments-registry', () => ({
  loadContractAddress: (...args: unknown[]) => mockLoadContractAddress(...args),
}));

// Mock viem so tests don't actually hit Arbitrum Sepolia RPC.
const mockReadContract = vi.fn();
const mockGetBalance = vi.fn();
vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: (...args: unknown[]) => mockReadContract(...args),
      getBalance: (...args: unknown[]) => mockGetBalance(...args),
    })),
    http: vi.fn(() => ({})),
  };
});

import { GET } from './route';

/**
 * Audit 2026-05-24 G-2 fix: prior route returned a hardcoded
 * `{available:false, reason:"adapter pending Curator whitelist"}` regardless
 * of on-chain state. The new route reads Faucet.usdcDrop / ethDrop /
 * cooldown / lastClaim and USDC.balanceOf(faucet) to compute liveness.
 *
 * These tests lock the new behavior:
 *   - Missing faucet address in registry → honest pending
 *   - RPC failure → honest pending with surfaced reason
 *   - Stocked + wallet not in cooldown → available
 *   - Stocked but USDC under per-claim drop → unavailable with stock reason
 *   - Stocked but wallet in cooldown → unavailable with cooldown reason
 */

function makeReq(query?: string) {
  const url = query
    ? `http://localhost/api/faucet/status?${query}`
    : 'http://localhost/api/faucet/status';
  return new Request(url) as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/faucet/status - honest pending', () => {
  it('returns available:false + named reason when faucet is not in registry', async () => {
    mockLoadContractAddress.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.source).toBe('pending');
    expect(body.reason).toMatch(/registry/i);
  });

  it('returns available:false with surfaced reason when RPC probe throws', async () => {
    mockLoadContractAddress.mockResolvedValueOnce('0x' + '7'.repeat(40));
    mockReadContract.mockRejectedValueOnce(new Error('econnrefused'));
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.source).toBe('pending');
    expect(body.reason).toMatch(/RPC probe failed/i);
  });
});

describe('GET /api/faucet/status - on-chain read', () => {
  function stockFaucet(opts: {
    usdcDrop: bigint;
    ethDrop: bigint;
    cooldown: bigint;
    faucetUsdcBalance: bigint;
    faucetEthBalance: bigint;
    walletLastClaim?: bigint;
  }) {
    // Order matters: route awaits usdc / usdcDrop / ethDrop / cooldown in
    // parallel, then balanceOf + getBalance, then optionally lastClaim.
    mockReadContract
      .mockResolvedValueOnce('0x' + 'a'.repeat(40))               // usdc()
      .mockResolvedValueOnce(opts.usdcDrop)                       // usdcDrop()
      .mockResolvedValueOnce(opts.ethDrop)                        // ethDrop()
      .mockResolvedValueOnce(opts.cooldown)                       // cooldown()
      .mockResolvedValueOnce(opts.faucetUsdcBalance)              // balanceOf(faucet)
      .mockResolvedValueOnce(opts.walletLastClaim ?? 0n);         // lastClaim(wallet)
    mockGetBalance.mockResolvedValueOnce(opts.faucetEthBalance);
  }

  it('returns available:true when stocked and wallet cooldown elapsed', async () => {
    mockLoadContractAddress.mockResolvedValueOnce('0x' + '7'.repeat(40));
    stockFaucet({
      usdcDrop: 10_000_000n,           // 10 USDC (6 dp)
      ethDrop: 1_000_000_000_000_000n, // 0.001 ETH
      cooldown: 86_400n,               // 24h
      faucetUsdcBalance: 100_000_000n, // 100 USDC stocked
      faucetEthBalance: 10_000_000_000_000_000n, // 0.01 ETH stocked
      walletLastClaim: 0n,             // never claimed
    });
    const res = await GET(makeReq('wallet=0x' + 'b'.repeat(40)));
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.source).toBe('faucet');
    expect(body.usdcDrop).toBe(10);
    expect(body.faucetUsdcBalance).toBe(100);
    expect(body.walletCooldownRemainingSec).toBe(0);
    expect(body.reason).toBeNull();
  });

  it('returns available:false with stock reason when faucet USDC below drop', async () => {
    mockLoadContractAddress.mockResolvedValueOnce('0x' + '7'.repeat(40));
    stockFaucet({
      usdcDrop: 10_000_000n,
      ethDrop: 0n,
      cooldown: 86_400n,
      faucetUsdcBalance: 1_000_000n,   // only 1 USDC - under the 10 drop
      faucetEthBalance: 0n,
    });
    const res = await GET(makeReq('wallet=0x' + 'b'.repeat(40)));
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toMatch(/USDC stock/i);
  });

  it('returns available:false with cooldown reason when wallet is mid-cooldown', async () => {
    mockLoadContractAddress.mockResolvedValueOnce('0x' + '7'.repeat(40));
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    stockFaucet({
      usdcDrop: 10_000_000n,
      ethDrop: 0n,
      cooldown: 86_400n,
      faucetUsdcBalance: 100_000_000n,
      faucetEthBalance: 0n,
      walletLastClaim: nowSec - 3600n, // claimed 1h ago, 23h cooldown left
    });
    const res = await GET(makeReq('wallet=0x' + 'b'.repeat(40)));
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toMatch(/cooldown/i);
    expect(body.walletCooldownRemainingSec).toBeGreaterThan(0);
  });
});
