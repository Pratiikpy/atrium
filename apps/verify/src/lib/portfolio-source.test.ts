import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadContractAddress: vi.fn(),
  createPublicClient: vi.fn(),
  http: vi.fn(),
  getContract: vi.fn(),
}));

vi.mock('./deployments-registry', () => ({
  loadContractAddress: mocks.loadContractAddress,
}));

vi.mock('viem', async () => {
  const real = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...real,
    createPublicClient: mocks.createPublicClient,
    http: mocks.http,
    getContract: mocks.getContract,
  };
});

vi.mock('viem/chains', () => ({
  arbitrumSepolia: { id: 421614 },
}));

/**
 * Iter 72 audit fix: pins the Wave-II address-rotation cache safety
 * on tryGetPlinth(). Pre-iter-72 zero tests pinned this even though
 * a stale-cache bug on rotation would serve old data against the
 * NEW contract address for 60 seconds, and the route's catch handler
 * masks the resulting failure as "pending" with no operator signal.
 *
 * Contract:
 *   - Returns null when loadContractAddress yields null.
 *   - Caches the constructed client for 60s by (timestamp, address)
 *     tuple. Address rotation invalidates immediately.
 *   - Returns null on viem construction error (catch path).
 */

beforeEach(() => {
  mocks.loadContractAddress.mockReset();
  mocks.createPublicClient.mockReset();
  mocks.http.mockReset();
  mocks.getContract.mockReset();
  mocks.createPublicClient.mockReturnValue({});
  mocks.http.mockReturnValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('tryGetPlinth, null on missing deployment', () => {
  it('returns null when loadContractAddress returns null', async () => {
    mocks.loadContractAddress.mockResolvedValue(null);
    vi.resetModules();
    const { tryGetPlinth } = await import('./portfolio-source');
    expect(await tryGetPlinth()).toBeNull();
  });

  it('does NOT call viem when address absent', async () => {
    mocks.loadContractAddress.mockResolvedValue(null);
    vi.resetModules();
    const { tryGetPlinth } = await import('./portfolio-source');
    await tryGetPlinth();
    expect(mocks.createPublicClient).not.toHaveBeenCalled();
    expect(mocks.getContract).not.toHaveBeenCalled();
  });
});

describe('tryGetPlinth, happy path + cache', () => {
  it('constructs a client when address present', async () => {
    const addr = '0x' + '1'.repeat(40);
    mocks.loadContractAddress.mockResolvedValue(addr);
    const fakeClient = { read: { getAccount: vi.fn() } };
    mocks.getContract.mockReturnValue(fakeClient);
    vi.resetModules();
    const { tryGetPlinth } = await import('./portfolio-source');
    const client = await tryGetPlinth();
    expect(client).toBe(fakeClient);
    expect(mocks.createPublicClient).toHaveBeenCalledTimes(1);
    expect(mocks.getContract).toHaveBeenCalledTimes(1);
  });

  it('serves the same cached client on repeated calls within 60s', async () => {
    const addr = '0x' + '1'.repeat(40);
    mocks.loadContractAddress.mockResolvedValue(addr);
    const fakeClient = { read: { getAccount: vi.fn() } };
    mocks.getContract.mockReturnValue(fakeClient);
    vi.resetModules();
    const { tryGetPlinth } = await import('./portfolio-source');

    await tryGetPlinth();
    await tryGetPlinth();
    await tryGetPlinth();
    // Cache hit on call 2 and 3, viem constructors only called once.
    expect(mocks.createPublicClient).toHaveBeenCalledTimes(1);
    expect(mocks.getContract).toHaveBeenCalledTimes(1);
  });

  it('Wave-II: invalidates cache on address rotation', async () => {
    const addr1 = '0x' + '1'.repeat(40);
    const addr2 = '0x' + '2'.repeat(40);
    const fakeClient = { read: { getAccount: vi.fn() } };
    mocks.getContract.mockReturnValue(fakeClient);
    vi.resetModules();
    const { tryGetPlinth } = await import('./portfolio-source');

    // First call resolves addr1, caches.
    mocks.loadContractAddress.mockResolvedValue(addr1);
    await tryGetPlinth();
    expect(mocks.createPublicClient).toHaveBeenCalledTimes(1);

    // Praetor rotates Plinth. Same in-process module, the cache must
    // notice the address changed and rebuild immediately, not serve
    // a stale client tied to the OLD address.
    mocks.loadContractAddress.mockResolvedValue(addr2);
    await tryGetPlinth();
    expect(mocks.createPublicClient).toHaveBeenCalledTimes(2);
    // The second getContract call must use the NEW address.
    expect(mocks.getContract.mock.calls[1][0].address).toBe(addr2);
  });

  it('clears cache when loadContractAddress later returns null', async () => {
    const addr = '0x' + '1'.repeat(40);
    mocks.loadContractAddress.mockResolvedValue(addr);
    mocks.getContract.mockReturnValue({ read: { getAccount: vi.fn() } });
    vi.resetModules();
    const { tryGetPlinth } = await import('./portfolio-source');

    await tryGetPlinth();
    expect(mocks.createPublicClient).toHaveBeenCalledTimes(1);

    // Registry file deleted mid-rotation → addr becomes null.
    mocks.loadContractAddress.mockResolvedValue(null);
    const second = await tryGetPlinth();
    expect(second).toBeNull();

    // When a fresh address comes back, the cache must rebuild (not
    // resurrect the stale client).
    mocks.loadContractAddress.mockResolvedValue(addr);
    await tryGetPlinth();
    expect(mocks.createPublicClient).toHaveBeenCalledTimes(2);
  });
});

describe('tryGetPlinth, viem construction error', () => {
  it('returns null when getContract throws', async () => {
    mocks.loadContractAddress.mockResolvedValue('0x' + '1'.repeat(40));
    mocks.getContract.mockImplementation(() => {
      throw new Error('viem boom');
    });
    vi.resetModules();
    const { tryGetPlinth } = await import('./portfolio-source');
    expect(await tryGetPlinth()).toBeNull();
  });

  it('returns null when createPublicClient throws', async () => {
    mocks.loadContractAddress.mockResolvedValue('0x' + '1'.repeat(40));
    mocks.createPublicClient.mockImplementation(() => {
      throw new Error('rpc boom');
    });
    vi.resetModules();
    const { tryGetPlinth } = await import('./portfolio-source');
    expect(await tryGetPlinth()).toBeNull();
  });
});
