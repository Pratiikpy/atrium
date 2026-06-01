import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/portfolio-source', () => ({
  tryGetPlinth: vi.fn(),
}));

import { tryGetPlinth } from '@/lib/portfolio-source';

/**
 * Iter 64 audit fix: locks the LL-9 fix on /api/portfolio/summary.
 *
 * - LL-9: pre-fix the route had a hand-rolled `fmtUsdc` that truncated
 *   the fractional part, $1.999999 rendered as "$1.99" instead of
 *   locale-rounding to "$2.00". The fix calls the audit-tested
 *   formatUsd helper which uses Intl.NumberFormat round-half-even
 *   semantics and adds thousands separators consistently.
 *
 * Also pins the contract surface: collateral / required / notional
 * render through formatUsd (load-bearing, a future refactor wiring
 * a different formatter would silently break the dashboard
 * "$X collateral, $Y margin used" numbers).
 */

const ORIGINAL_WALLET = process.env.DEMO_WALLET_ADDRESS;
const TEST_WALLET = '0x' + 'a'.repeat(40);

function fakePlinth(collateral: bigint, required: bigint, notional: bigint, paused: boolean) {
  return {
    read: {
      getAccount: vi.fn().mockResolvedValue([collateral, required, notional, paused] as [bigint, bigint, bigint, boolean]),
    },
  };
}

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

describe('GET /api/portfolio/summary, LL-9 formatUsd', () => {
  it('formats USDC values with $ prefix and 2 decimals', async () => {
    // 1_500_000 micro-USDC = $1.50
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(1_500_000n, 500_000n, 2_000_000n, false));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.totalAccountValueUsd).toBe('$1.50');
    expect(json.totalRequiredMarginUsd).toBe('$0.50');
    expect(json.totalNotionalUsd).toBe('$2.00');
  });

  it('rounds half-even at the cent boundary (LL-9 fix)', async () => {
    // $1.999999 = 1_999_999 micro-USDC. Pre-LL-9: "$1.99" (truncate).
    // Post-LL-9: formatUsd's Intl.NumberFormat rounds to "$2.00".
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(1_999_999n, 0n, 0n, false));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.totalAccountValueUsd).toBe('$2.00');
  });

  it('renders thousands separators on large USDC values', async () => {
    // 1_234_567_890_000 micro-USDC = $1,234,567.89. Locale separators
    // are part of the LL-9 contract, without them, a $1M position
    // shows as "$1234567.89" and harder to scan.
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(1_234_567_890_000n, 0n, 0n, false));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.totalAccountValueUsd).toBe('$1,234,567.89');
  });

  it('passes through paused flag from Plinth', async () => {
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(0n, 0n, 0n, true));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.paused).toBe(true);
  });

  it('U-23: success path returns null pnl + null direction (no measured-zero claim)', async () => {
    // Pre-U-23 the route returned `pnl24hDirection: 'flat'` next to
    // `pnl24hUsd: null`, direction implied a measured-zero PnL while
    // the value was honest-unmeasured. The success path now matches the
    // pending path: both fields null until a 24h-PnL source lands.
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(1n, 0n, 0n, false));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('plinth');
    expect(json.pnl24hUsd).toBeNull();
    expect(json.pnl24hDirection).toBeNull();
  });
});

describe('GET /api/portfolio/summary, pending paths', () => {
  it('returns pending when plinth is unavailable', async () => {
    (tryGetPlinth as any).mockResolvedValue(null);
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.totalAccountValueUsd).toBeNull();
    expect(json.totalRequiredMarginUsd).toBeNull();
    expect(json.totalNotionalUsd).toBeNull();
    expect(json.pnl24hUsd).toBeNull();
    expect(json.pnl24hDirection).toBeNull();
  });

  it('returns pending when wallet env unset', async () => {
    delete process.env.DEMO_WALLET_ADDRESS;
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(1n, 0n, 0n, false));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });

  it('returns pending on Plinth read failure', async () => {
    const plinth = {
      read: { getAccount: vi.fn().mockRejectedValue(new Error('revert')) },
    };
    (tryGetPlinth as any).mockResolvedValue(plinth);
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.totalAccountValueUsd).toBeNull();
  });
});
