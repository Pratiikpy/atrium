import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Iter 63 audit fix: locks the KK-5/6/7 + Q64.64 + MAX_SAFE clamp
 * fixes on /api/portfolio/positions. Pre-iter-63 zero tests pinned
 * any of them.
 *
 * - KK-5/6/7: route was doing `Number(big) / 1e6` in three places —
 *   size, notional, entryPrice. All lose precision past
 *   Number.MAX_SAFE_INTEGER on large notionals. formatUsd /
 *   formatShares preserve via BigInt + formatUnits.
 * - Q64.64 fixed-point extraction: `entryPriceQ64 >> 64n` pulls the
 *   integer part. Locked here so a refactor "fixing" the right-shift
 *   doesn't quietly destroy every entry price on the screen.
 * - MAX_SAFE_INTEGER clamp: an absurdly-high entryPrice value (e.g.
 *   buggy oracle output) must not ship `NaN` to the UI; the route
 *   clamps to Number.MAX_SAFE_INTEGER before Number() cast.
 * - Negative-notional sign rendering: `-${formatShares(abs)}` for
 *   shorts; without this, shorts would render as positive sizes and
 *   mislead users about position direction.
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

function makePosition(overrides: Partial<{
  id: string;
  venueId: number;
  instrumentId: string;
  notionalSigned: string;
  entryPriceQ64: string;
}> = {}) {
  return {
    id: 'p1',
    venueId: 1,
    instrumentId: '0x' + 'a'.repeat(64),
    notionalSigned: '1000000', // 1 USDC
    entryPriceQ64: ((100n) << 64n).toString(), // $100 in Q64.64
    closedAtBlock: null,
    ...overrides,
  };
}

describe('GET /api/portfolio/positions — KK-5/6/7 precision', () => {
  it('renders size via formatShares (KK-5)', async () => {
    (gql as any).mockResolvedValue({
      positions: [makePosition({ notionalSigned: '5500000' })], // 5.5 USDC
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.positions[0].size).toBe('5.50');
  });

  it('renders notionalUsd via formatUsd with $ prefix (KK-6)', async () => {
    (gql as any).mockResolvedValue({
      positions: [makePosition({ notionalSigned: '12345678' })], // 12.35 USDC
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.positions[0].notionalUsd).toBe('$12.35');
  });

  it('preserves precision on very large notional (KK-6)', async () => {
    // $10B notional. Pre-fix `Number(big) / 1e6` would round at this
    // scale; formatUsd's locale-aware formatting keeps the digits.
    (gql as any).mockResolvedValue({
      positions: [makePosition({ notionalSigned: '10000000000000000' })], // 1e16 = $10B
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.positions[0].notionalUsd).toBe('$10,000,000,000.00');
  });
});

describe('GET /api/portfolio/positions — Q64.64 entry-price extraction', () => {
  it('extracts integer entry price via >> 64n', async () => {
    // $250 in Q64.64 = 250 << 64. The route shifts right 64 and renders.
    (gql as any).mockResolvedValue({
      positions: [makePosition({ entryPriceQ64: ((250n) << 64n).toString() })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.positions[0].entryPrice).toBe('$250');
  });

  it('returns markPrice + pnlUsd as null until an oracle is wired (audit U-21)', async () => {
    (gql as any).mockResolvedValue({
      positions: [makePosition({ entryPriceQ64: ((1234n) << 64n).toString() })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // Pre-U-21 the route shipped `markPrice = entryPrice` and
    // `pnlUsd = '$0.00'` — both presented as measured truth even though
    // no oracle reads or P&L settlement existed. Protocol integrity rule:
    // "never display a placeholder number that looks real." Now null so
    // the UI renders "—" with a named pending caption.
    expect(json.positions[0].entryPrice).toBe('$1,234');
    expect(json.positions[0].markPrice).toBeNull();
    expect(json.positions[0].pnlUsd).toBeNull();
    expect(json.positions[0].markSource).toBe('pending');
  });

  it('exposes venuePositionId so the close action can pass it back to the adapter', async () => {
    (gql as any).mockResolvedValue({
      positions: [makePosition({ id: 'plinth-42-1' })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.positions[0].venuePositionId).toBe('plinth-42-1');
  });

  it('U-33: returns entryPrice=null when subgraph ships entryPriceQ64=0', async () => {
    // subgraph/src/plinth.ts:90 ships entryPriceQ64 = 0 until Plinth's
    // event-extension-v2 emits the entry price on open. Pre-U-33 the
    // route rendered "$0" for every position — fake-zero. Now null so
    // the table shows "—" with a named pending tooltip.
    (gql as any).mockResolvedValue({
      positions: [makePosition({ entryPriceQ64: '0' })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.positions[0].entryPrice).toBeNull();
  });

  it('U-33: returns real entryPrice when subgraph ships a non-zero value', async () => {
    // Locks the positive path so a future refactor doesn't accidentally
    // null out real measurements.
    (gql as any).mockResolvedValue({
      positions: [makePosition({ entryPriceQ64: ((250n) << 64n).toString() })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.positions[0].entryPrice).toBe('$250');
  });

  it('clamps entryPrice at Number.MAX_SAFE_INTEGER (KK-7)', async () => {
    // A buggy oracle / Scribe row produces an absurdly-high price BigInt
    // whose integer part > Number.MAX_SAFE_INTEGER. Without the clamp,
    // `Number(big)` would lose precision; with it, the UI shows the
    // clamp value instead of NaN or a wrong-magnitude number.
    const absurd = (BigInt(Number.MAX_SAFE_INTEGER) + 1_000_000n) << 64n;
    (gql as any).mockResolvedValue({
      positions: [makePosition({ entryPriceQ64: absurd.toString() })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // MAX_SAFE_INTEGER = 9_007_199_254_740_991. Locale format:
    // "9,007,199,254,740,991".
    expect(json.positions[0].entryPrice).toBe('$9,007,199,254,740,991');
  });
});

describe('GET /api/portfolio/positions — negative-notional sign rendering', () => {
  it('renders short positions with leading minus on size', async () => {
    // Two's-complement negative bigint serialized as decimal: prefix "-".
    (gql as any).mockResolvedValue({
      positions: [makePosition({ notionalSigned: '-3000000' })], // -3 USDC short
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.positions[0].size).toBe('-3.00');
    // notionalUsd uses absolute value (the position has $3 of notional,
    // direction is captured in `size`'s sign + a future `direction` field).
    expect(json.positions[0].notionalUsd).toBe('$3.00');
  });

  it('renders long positions without a sign prefix', async () => {
    (gql as any).mockResolvedValue({
      positions: [makePosition({ notionalSigned: '7000000' })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.positions[0].size).toBe('7.00');
    expect(json.positions[0].size.startsWith('-')).toBe(false);
  });
});

describe('GET /api/portfolio/positions — venue label resolution', () => {
  it('resolves recognized venueId to its venue label', async () => {
    (gql as any).mockResolvedValue({
      positions: [makePosition({ venueId: 1 })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // venueId 1 must resolve to a non-fallback label.
    expect(json.positions[0].venue).not.toMatch(/^venue-\d+$/);
    expect(json.positions[0].venueId).toBe(1);
  });

  it('falls back to "venue-<id>" for unrecognized venueId', async () => {
    (gql as any).mockResolvedValue({
      positions: [makePosition({ venueId: 99 })], // not in VENUES
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.positions[0].venue).toBe('venue-99');
  });
});

describe('GET /api/portfolio/positions — pending paths', () => {
  it('returns pending when wallet env unset', async () => {
    delete process.env.DEMO_WALLET_ADDRESS;
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.positions).toEqual([]);
  });

  it('returns pending on gql failure', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe outage'));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.positions).toEqual([]);
  });

  it('returns source:scribe with successful response (truncates instrumentId)', async () => {
    (gql as any).mockResolvedValue({
      positions: [makePosition({ instrumentId: '0xabcd' + 'f'.repeat(60) })],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('scribe');
    // The route truncates to first 8 chars + ellipsis.
    expect(json.positions[0].instrument).toBe('0xabcdff…');
  });
});
