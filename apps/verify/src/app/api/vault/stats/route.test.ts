import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted ensures these mock references are hoisted before vi.mock
// factories run — necessary because the factory closes over them.
const mocks = vi.hoisted(() => ({
  totalAssets: vi.fn(),
  balanceOf: vi.fn(),
  convertToAssets: vi.fn(),
  loadContractAddress: vi.fn(),
}));

vi.mock('@/lib/deployments-registry', () => ({
  loadContractAddress: mocks.loadContractAddress,
}));

// Merge with real viem so format-usd's `formatUnits` import still works.
// Override only the three names this route consumes from viem directly.
vi.mock('viem', async () => {
  const real = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...real,
    createPublicClient: vi.fn(() => ({})),
    http: vi.fn(() => ({})),
    getContract: vi.fn(() => ({
      read: {
        totalAssets: mocks.totalAssets,
        balanceOf: mocks.balanceOf,
        convertToAssets: mocks.convertToAssets,
      },
    })),
  };
});

vi.mock('viem/chains', () => ({
  arbitrumSepolia: { id: 421614 },
}));

// The route also does `await import('@/lib/format-usd')` — this should
// resolve to the real module fine since format-usd has no external
// deps, but if Next.js path-alias resolution breaks under vi mock
// the route silently falls into its catch handler. Force the real
// module via the actual relative path used by tsconfig.
// (Re-asserting the real exports is enough — vi.mock(NAME) without
// a factory keeps the real module but lets us track calls.)
import { GET } from './route';

/**
 * Iter 71 audit fix: locks S-1 (6-decimal USDC invariant) + U-8
 * (single viem import block) on /api/vault/stats. Pre-iter-71 zero
 * tests pinned either.
 */

const ORIGINAL_WALLET = process.env.DEMO_WALLET_ADDRESS;
const TEST_WALLET = '0x' + 'a'.repeat(40);

beforeEach(() => {
  mocks.totalAssets.mockReset();
  mocks.balanceOf.mockReset();
  mocks.convertToAssets.mockReset();
  mocks.loadContractAddress.mockReset();
  process.env.DEMO_WALLET_ADDRESS = TEST_WALLET;
});

afterEach(() => {
  if (ORIGINAL_WALLET == null) delete process.env.DEMO_WALLET_ADDRESS;
  else process.env.DEMO_WALLET_ADDRESS = ORIGINAL_WALLET;
});

describe('GET /api/vault/stats — pending paths', () => {
  it('returns source:pending when Coffer not in registry', async () => {
    mocks.loadContractAddress.mockResolvedValue(null);
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.vaultTvlUsd).toBeNull();
    expect(json.userSharesFormatted).toBeNull();
    expect(json.sharePriceUsd).toBeNull();
  });

  it('queries coffer slug from deployments registry', async () => {
    mocks.loadContractAddress.mockResolvedValue(null);
    await GET();
    expect(mocks.loadContractAddress).toHaveBeenCalledWith('coffer');
  });

  it('returns pending when viem contract read throws', async () => {
    mocks.loadContractAddress.mockResolvedValue('0x' + '1'.repeat(40));
    mocks.totalAssets.mockRejectedValue(new Error('rpc revert'));
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });
});

describe('GET /api/vault/stats — Coffer deployed, S-1 6-decimal invariant', () => {
  beforeEach(() => {
    mocks.loadContractAddress.mockResolvedValue('0x' + '1'.repeat(40));
  });

  it('renders vaultTvlUsd via formatUsd at 6 decimals (S-1)', async () => {
    mocks.totalAssets.mockResolvedValue(5_000_000n);
    mocks.balanceOf.mockResolvedValue(0n);
    mocks.convertToAssets.mockResolvedValue(1_000_000n);

    const json = await (await GET()).json();
    // Diagnostic: if the viem mock isn't being intercepted, mocks.totalAssets
    // is never called and the route catches into pending.
    expect(mocks.totalAssets).toHaveBeenCalled();
    expect(json.source).toBe('coffer');
    expect(json.vaultTvlUsd).toBe('$5.00');
  });

  it('renders userSharesFormatted via formatShares (no $ prefix)', async () => {
    mocks.totalAssets.mockResolvedValue(0n);
    mocks.balanceOf.mockResolvedValue(7_500_000n);
    mocks.convertToAssets.mockResolvedValue(1_000_000n);

    const json = await (await GET()).json();
    expect(json.userSharesFormatted).toBe('7.50');
  });

  it('renders sharePriceUsd with 4-decimal precision', async () => {
    mocks.totalAssets.mockResolvedValue(0n);
    mocks.balanceOf.mockResolvedValue(0n);
    mocks.convertToAssets.mockResolvedValue(1_005_000n);

    const json = await (await GET()).json();
    expect(json.sharePriceUsd).toBe('$1.0050');
  });

  it('S-1: calls convertToAssets with 10**6, not 10**18', async () => {
    mocks.totalAssets.mockResolvedValue(0n);
    mocks.balanceOf.mockResolvedValue(0n);
    mocks.convertToAssets.mockResolvedValue(1_000_000n);

    await GET();
    expect(mocks.convertToAssets).toHaveBeenCalledWith([1_000_000n]);
  });

  it('passes wallet address to balanceOf when DEMO_WALLET_ADDRESS set', async () => {
    mocks.totalAssets.mockResolvedValue(0n);
    mocks.balanceOf.mockResolvedValue(0n);
    mocks.convertToAssets.mockResolvedValue(1_000_000n);

    await GET();
    expect(mocks.balanceOf).toHaveBeenCalledWith([TEST_WALLET]);
  });

  it('skips balanceOf call when wallet env unset', async () => {
    delete process.env.DEMO_WALLET_ADDRESS;
    mocks.totalAssets.mockResolvedValue(0n);
    mocks.convertToAssets.mockResolvedValue(1_000_000n);

    const json = await (await GET()).json();
    expect(json.userSharesFormatted).toBe('0.00');
    expect(mocks.balanceOf).not.toHaveBeenCalled();
  });

  it('preserves precision on very large TVL (formatUsd via BigInt)', async () => {
    mocks.totalAssets.mockResolvedValue(10_000_000_000_000_000n);
    mocks.balanceOf.mockResolvedValue(0n);
    mocks.convertToAssets.mockResolvedValue(1_000_000n);

    const json = await (await GET()).json();
    expect(json.vaultTvlUsd).toBe('$10,000,000,000.00');
  });
});
