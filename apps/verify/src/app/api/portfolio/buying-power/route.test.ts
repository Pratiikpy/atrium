import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Iter 62 audit fix: locks KK-3 + KK-4 fixes on
 * /api/portfolio/buying-power. Zero tests pinned them pre-iter-62.
 *
 * - KK-3: drop rows whose `timestamp` parses to NaN. Pre-fix a
 *   Scribe row with a malformed timestamp would push a chart point
 *   with `ts: NaN`, rendering an invisible / off-axis tick that
 *   misalignsed the time-series with reality. The fix calls
 *   parseTsOrNull and skips on null.
 * - KK-4: free-margin = collateral - required is a BigInt subtract.
 *   The formatUsd helper preserves precision past
 *   Number.MAX_SAFE_INTEGER (audit T-4 lineage).
 *
 * The route requires DEMO_WALLET_ADDRESS to be set before it
 * attempts the gql call. Each test sets that env var via the
 * vitest setup pattern so the gql mock actually fires.
 */

const ORIGINAL_DEMO_WALLET = process.env.DEMO_WALLET_ADDRESS;
const TEST_WALLET = '0x' + 'a'.repeat(40);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.DEMO_WALLET_ADDRESS = TEST_WALLET;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_DEMO_WALLET == null) delete process.env.DEMO_WALLET_ADDRESS;
  else process.env.DEMO_WALLET_ADDRESS = ORIGINAL_DEMO_WALLET;
});

describe('GET /api/portfolio/buying-power, KK-3 NaN-timestamp drop', () => {
  it('drops series rows whose timestamp is empty', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [
        { blockNumber: '100', timestamp: '1700000000', collateralValueWei: '5000000', requiredMarginWei: '1000000' },
        { blockNumber: '101', timestamp: '', collateralValueWei: '5000000', requiredMarginWei: '1000000' },
        { blockNumber: '102', timestamp: '1700000200', collateralValueWei: '5000000', requiredMarginWei: '1000000' },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // Empty timestamp must be dropped. Expect 2 points, not 3.
    expect(json.series).toHaveLength(2);
    expect(json.source).toBe('plinth');
  });

  it('drops series rows whose timestamp is non-numeric', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [
        { blockNumber: '100', timestamp: '1700000000', collateralValueWei: '5000000', requiredMarginWei: '1000000' },
        { blockNumber: '101', timestamp: 'NaN', collateralValueWei: '5000000', requiredMarginWei: '1000000' },
        { blockNumber: '102', timestamp: 'undefined', collateralValueWei: '5000000', requiredMarginWei: '1000000' },
        { blockNumber: '103', timestamp: '1700000300', collateralValueWei: '5000000', requiredMarginWei: '1000000' },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.series).toHaveLength(2);
  });

  it('drops series rows whose timestamp is negative or implausibly large', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [
        { blockNumber: '100', timestamp: '1700000000', collateralValueWei: '5000000', requiredMarginWei: '1000000' },
        { blockNumber: '101', timestamp: '-1', collateralValueWei: '5000000', requiredMarginWei: '1000000' },
        { blockNumber: '102', timestamp: '999999999999', collateralValueWei: '5000000', requiredMarginWei: '1000000' },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // parseTsOrNull rejects negative AND rejects values > year 9999.
    expect(json.series).toHaveLength(1);
  });

  it('preserves all rows when every timestamp parses cleanly', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [
        { blockNumber: '100', timestamp: '1700000000', collateralValueWei: '5000000', requiredMarginWei: '1000000' },
        { blockNumber: '101', timestamp: '1700000100', collateralValueWei: '6000000', requiredMarginWei: '1000000' },
        { blockNumber: '102', timestamp: '1700000200', collateralValueWei: '7000000', requiredMarginWei: '1000000' },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.series).toHaveLength(3);
  });
});

describe('GET /api/portfolio/buying-power, KK-4 formatUsd precision', () => {
  it('computes free margin via BigInt subtract (collateral - required)', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [
        { blockNumber: '100', timestamp: '1700000000', collateralValueWei: '10000000', requiredMarginWei: '3000000' },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // 10_000_000 - 3_000_000 = 7_000_000 micro-USDC = $7.00. formatUsd
    // output: "$7.00" with locale separator (none needed at this scale).
    expect(json.series[0].valueUsd).toBe('$7.00');
    expect(json.currentUsd).toBe('$7.00');
  });

  it('clamps free margin to 0 when required exceeds collateral', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [
        { blockNumber: '100', timestamp: '1700000000', collateralValueWei: '2000000', requiredMarginWei: '5000000' },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // Under-collateralized account: free margin must clamp to 0, not
    // render a negative value or wrap-around BigInt underflow.
    expect(json.series[0].valueUsd).toBe('$0.00');
  });

  it('preserves precision on large free-margin (KK-4)', async () => {
    // 10B USDC collateral, 1B USDC required → 9B free margin. BigInt
    // subtract preserves precision exactly; formatUsd renders with
    // locale separators.
    (gql as any).mockResolvedValue({
      marginUpdates: [
        {
          blockNumber: '100',
          timestamp: '1700000000',
          collateralValueWei: '10000000000000000', // 1e16 micro-USDC = $10B
          requiredMarginWei: '1000000000000000', //  1e15 micro-USDC = $1B
        },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.series[0].valueUsd).toBe('$9,000,000,000.00');
  });
});

describe('GET /api/portfolio/buying-power, pending paths', () => {
  it('returns source:pending when wallet env is unset', async () => {
    delete process.env.DEMO_WALLET_ADDRESS;
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.currentUsd).toBeNull();
    expect(json.series).toEqual([]);
    expect(json.windowDays).toBe(30);
  });

  it('returns source:pending on gql failure (Scribe outage)', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe 503'));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.currentUsd).toBeNull();
    expect(json.series).toEqual([]);
  });
});
