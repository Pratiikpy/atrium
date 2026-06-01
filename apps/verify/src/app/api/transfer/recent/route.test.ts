import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Iter 70 audit fix: locks NN-7 (formatShares precision) on
 * /api/transfer/recent.
 */

const ORIGINAL_WALLET = process.env.DEMO_WALLET_ADDRESS;
const TEST_WALLET = '0x' + 'a'.repeat(40);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.DEMO_WALLET_ADDRESS = TEST_WALLET;
});
afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_WALLET == null) delete process.env.DEMO_WALLET_ADDRESS;
  else process.env.DEMO_WALLET_ADDRESS = ORIGINAL_WALLET;
});

describe('GET /api/transfer/recent, pending paths', () => {
  it('returns pending when wallet env unset', async () => {
    delete process.env.DEMO_WALLET_ADDRESS;
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.transfers).toEqual([]);
  });

  it('returns pending on gql failure', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe outage'));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.transfers).toEqual([]);
  });
});

describe('GET /api/transfer/recent, happy path', () => {
  it('maps each Scribe credit to wire-safe transfer (NN-7 precision)', async () => {
    (gql as any).mockResolvedValue({
      crossChainCredits: [
        { id: '0xtx1', amountWei: '5000000', isSettled: true, isClaimedBack: false, createdAtBlock: '100' },
        { id: '0xtx2', amountWei: '3000000', isSettled: false, isClaimedBack: false, createdAtBlock: '101' },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('scribe');
    expect(json.transfers).toHaveLength(2);
    expect(json.transfers[0].id).toBe('0xtx1');
    expect(json.transfers[0].status).toBe('SETTLED');
    expect(json.transfers[0].amount).toBe('5.00');
    expect(json.transfers[1].status).toBe('IN_TRANSIT');
  });

  it('renders CLAIMED_BACK when isClaimedBack:true', async () => {
    (gql as any).mockResolvedValue({
      crossChainCredits: [
        { id: '0xc1', amountWei: '1000000', isSettled: false, isClaimedBack: true, createdAtBlock: '102' },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.transfers[0].status).toBe('CLAIMED_BACK');
  });

  it('preserves precision past Number safe-int (NN-7)', async () => {
    (gql as any).mockResolvedValue({
      crossChainCredits: [
        { id: '0xbig', amountWei: '10000000000000000', isSettled: true, isClaimedBack: false, createdAtBlock: '103' },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.transfers[0].amount).toBe('10,000,000,000.00');
  });

  it('returns empty transfers when Scribe array is empty', async () => {
    (gql as any).mockResolvedValue({ crossChainCredits: [] });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('scribe');
    expect(json.transfers).toEqual([]);
  });
});
