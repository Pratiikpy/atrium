import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Iter 70 audit fix: locks KK-11 (formatShares precision) + 4-step
 * lifecycle rendering on /api/transfer/last.
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

describe('GET /api/transfer/last — empty / pending', () => {
  it('returns the 4-step pending shape when wallet env unset', async () => {
    delete process.env.DEMO_WALLET_ADDRESS;
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.amount).toBe('0');
    expect(json.steps).toHaveLength(4);
    expect(json.steps[0].status).toBe('pending');
    expect(json.txHash).toBeNull();
  });

  it('returns pending on gql failure', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe outage'));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });

  it('returns pending shape when no credits exist for the user', async () => {
    (gql as any).mockResolvedValue({ crossChainCredits: [] });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.amount).toBe('0');
  });
});

describe('GET /api/transfer/last — lifecycle status', () => {
  function makeCredit(overrides: Partial<{ id: string; isSettled: boolean; isClaimedBack: boolean; amountWei: string; createdAtBlock: string; settledAtBlock: string | null }> = {}) {
    return {
      id: '0xtxhash',
      amountWei: '5000000', // 5 USDC
      sourceChainSelector: 'arb',
      destChainSelector: 'rhc',
      isSettled: false,
      isClaimedBack: false,
      createdAtBlock: '100',
      settledAtBlock: null,
      ...overrides,
    };
  }

  it('renders status IN_TRANSIT when neither settled nor claimed back', async () => {
    (gql as any).mockResolvedValue({ crossChainCredits: [makeCredit()] });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.status).toBe('IN_TRANSIT');
    // Step 3 (CCIP message) should be in-progress, step 4 pending.
    expect(json.steps[2].status).toBe('in_progress');
    expect(json.steps[3].status).toBe('pending');
  });

  it('renders status SETTLED when isSettled=true', async () => {
    (gql as any).mockResolvedValue({
      crossChainCredits: [makeCredit({ isSettled: true })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.status).toBe('SETTLED');
    expect(json.steps[2].status).toBe('complete');
    expect(json.steps[3].status).toBe('complete');
  });

  it('renders status CLAIMED_BACK when isClaimedBack=true', async () => {
    (gql as any).mockResolvedValue({
      crossChainCredits: [makeCredit({ isSettled: false, isClaimedBack: true })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.status).toBe('CLAIMED_BACK');
  });

  it('KK-11: renders amount via formatShares (precision past safe-int)', async () => {
    (gql as any).mockResolvedValue({
      crossChainCredits: [
        // 10B USDC = 1e16 micro-USDC. Number() would lose precision;
        // formatShares uses BigInt + viem formatUnits.
        makeCredit({ amountWei: '10000000000000000' }),
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.amount).toBe('10,000,000,000.00');
  });

  it('passes id as txHash', async () => {
    (gql as any).mockResolvedValue({
      crossChainCredits: [makeCredit({ id: '0xdeadbeef' })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.txHash).toBe('0xdeadbeef');
  });

  // Audit U-22: step deltas were hardcoded ("0.0s" / "1.2s" / "3.4s" /
  // "8.4s") even on real transfers, so every CCIP message displayed the
  // same fake timing strings. The honest answer is null per-step (we
  // don't measure step-by-step timestamps) plus a real `blocksElapsed`
  // total derived from createdAtBlock vs settledAtBlock.
  it('U-22: never returns hardcoded per-step deltas', async () => {
    (gql as any).mockResolvedValue({
      crossChainCredits: [makeCredit({ isSettled: true, createdAtBlock: '1000', settledAtBlock: '1042' })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    for (const step of json.steps) {
      expect(step.delta).toBeNull();
    }
  });

  it('U-22: computes real blocksElapsed when settled', async () => {
    (gql as any).mockResolvedValue({
      crossChainCredits: [
        makeCredit({ isSettled: true, createdAtBlock: '1000', settledAtBlock: '1042' }),
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.blocksElapsed).toBe(42);
  });

  it('U-22: blocksElapsed is null when not yet settled', async () => {
    (gql as any).mockResolvedValue({
      crossChainCredits: [
        makeCredit({ isSettled: false, createdAtBlock: '1000', settledAtBlock: null }),
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.blocksElapsed).toBeNull();
  });
});
